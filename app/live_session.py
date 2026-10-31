"""Bridge between a browser WebSocket and a Gemini Live session.

Browser  --PCM 16k-->  FastAPI /ws  --PCM 16k-->  Gemini Live (native audio)
Browser  <--PCM 24k--               <--PCM 24k--

Text frames carry JSON control messages (transcripts, tool events,
interruptions); binary frames carry raw PCM audio both ways.
"""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import WebSocket
from google import genai
from google.genai import types

from . import config
from .tools import TOOL_DECLARATIONS, dispatch_tool

log = logging.getLogger("live_session")


def _live_config(rag_service=None, active_doc: str | None = None) -> types.LiveConnectConfig:
    sys_instruction = config.SYSTEM_INSTRUCTION
    if rag_service and hasattr(rag_service, "store") and rag_service.store.chunks:
        inventory = rag_service.store.get_document_inventory()
        inv_lines = [f"- {d['name']} ({d['chunks_count']} sections)" for d in inventory]
        inventory_str = "\n".join(inv_lines)
        focus_str = active_doc if active_doc else "Everything (All Documents)"
        sys_instruction += (
            f"\n\nCURRENT UPLOADED DOCUMENTS IN YOUR KNOWLEDGE BASE ({len(inventory)} total):\n"
            f"{inventory_str}\n"
            f"Active Focused Document Context: {focus_str}\n"
            "You have direct access to all of these documents. Never claim you cannot see them."
        )
    else:
        sys_instruction += "\n\nCURRENT KNOWLEDGE BASE: No documents uploaded yet. Ask the user to upload files."

    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=sys_instruction,
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=config.VOICE_NAME
                )
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
    )


async def _send_json(ws: WebSocket, payload: dict) -> None:
    await ws.send_text(json.dumps(payload))


async def handle_voice_session(ws: WebSocket, rag_service) -> None:
    """One browser connection = one Gemini Live session."""
    await ws.accept()
    client = genai.Client(api_key=config.GOOGLE_API_KEY)
    stop = asyncio.Event()
    session_context = {"active_doc": None}

    live_cfg = _live_config(rag_service, active_doc=session_context["active_doc"])

    try:
        async with client.aio.live.connect(
            model=config.LIVE_MODEL, config=live_cfg
        ) as session:
            log.info("Live session opened (model=%s)", config.LIVE_MODEL)
            await _send_json(ws, {"type": "status", "status": "ready"})

            async def browser_to_gemini() -> None:
                """Mic audio (binary) and control messages (text) -> Gemini."""
                while not stop.is_set():
                    try:
                        msg = await ws.receive()
                    except Exception:
                        break
                    if msg.get("type") == "websocket.disconnect":
                        break
                    if msg.get("bytes"):
                        try:
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=msg["bytes"],
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                        except Exception as e:
                            log.warning("Failed to send audio to Gemini: %s", e)
                            break
                    elif msg.get("text"):
                        try:
                            data = json.loads(msg["text"])
                            if data.get("type") == "ping":
                                await _send_json(ws, {"type": "pong"})
                            elif data.get("type") == "set_context":
                                raw_doc = data.get("doc_name") or None
                                resolved = None
                                if raw_doc and hasattr(rag_service, "store"):
                                    resolved = rag_service.store.resolve_document_name(raw_doc)
                                session_context["active_doc"] = resolved
                                log.info("Client context filter set to: %s (raw=%s)", resolved, raw_doc)
                                await _send_json(ws, {
                                    "type": "context_sync",
                                    "active_doc": resolved,
                                    "status": "active"
                                })
                        except Exception:
                            pass

            async def gemini_to_browser() -> None:
                """Gemini audio + transcripts + tool calls -> browser."""
                while not stop.is_set():
                    try:
                        turn_has_messages = False
                        async for msg in session.receive():
                            turn_has_messages = True
                            if stop.is_set():
                                return

                            # --- tool calls: run RAG / functions, reply to Gemini
                            if msg.tool_call:
                                for fc in msg.tool_call.function_calls:
                                    log.info("tool call: %s(%s)", fc.name, fc.args)
                                    detail = (fc.args or {}).get("question", "")
                                    if fc.name == "list_uploaded_documents":
                                        detail = "Checking uploaded documents inventory"
                                    await _send_json(ws, {
                                        "type": "tool", "name": fc.name,
                                        "detail": detail,
                                        "status": "running",
                                    })
                                    try:
                                        response, ui_event = await dispatch_tool(
                                            fc.name,
                                            fc.args or {},
                                            rag_service,
                                            doc_filter=session_context["active_doc"],
                                        )
                                        ui_event["status"] = "done"
                                    except Exception:
                                        log.exception(f"Tool {fc.name} failed")
                                        
                                        # Provide a clean, natural-language error to the AI so it can speak gracefully
                                        response = {
                                            "error": "The search database is temporarily unavailable due to high demand. Please apologize to the user and ask them to try asking again in a few moments."
                                        }
                                        
                                        # Provide a clean trace to the UI, hiding the ugly JSON stacktrace
                                        ui_event = {
                                            "type": "tool", "name": fc.name,
                                            "detail": "Search temporarily unavailable (Service overloaded)",
                                            "status": "done"
                                        }
                                    
                                    await _send_json(ws, ui_event)
                                    
                                    if ui_event.get("end_session"):
                                        await _send_json(ws, {"type": "end_session"})
                                        stop.set()
                                        return

                                    await session.send_tool_response(
                                        function_responses=[
                                            types.FunctionResponse(
                                                id=fc.id, name=fc.name,
                                                response=response,
                                            )
                                        ]
                                    )
                                continue

                            sc = msg.server_content
                            if sc is None:
                                continue

                            # --- interruption: tell browser to flush playback
                            if sc.interrupted:
                                log.info("Gemini Live detected user interruption")
                                await _send_json(ws, {"type": "interrupted"})
                                continue

                            # --- model audio out
                            if sc.model_turn:
                                for part in sc.model_turn.parts:
                                    if part.inline_data and part.inline_data.data:
                                        await ws.send_bytes(part.inline_data.data)

                            # --- transcripts (for the UI caption stream)
                            if sc.input_transcription and sc.input_transcription.text:
                                await _send_json(ws, {
                                    "type": "transcript", "role": "user",
                                    "text": sc.input_transcription.text,
                                    "is_interim": False,
                                })
                            if sc.output_transcription and sc.output_transcription.text:
                                await _send_json(ws, {
                                    "type": "transcript", "role": "agent",
                                    "text": sc.output_transcription.text,
                                    "is_interim": False,
                                })
                            if sc.turn_complete:
                                await _send_json(ws, {"type": "turn_complete"})

                        if not turn_has_messages and not stop.is_set():
                            await asyncio.sleep(0.05)

                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        if not stop.is_set():
                            log.exception("Error receiving from Gemini Live session: %s", e)
                        break

            tasks = [
                asyncio.create_task(browser_to_gemini()),
                asyncio.create_task(gemini_to_browser()),
            ]
            done, pending = await asyncio.wait(
                tasks, return_when=asyncio.FIRST_COMPLETED
            )
            stop.set()
            for t in pending:
                t.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for t in done:
                if not t.cancelled():
                    exc = t.exception()
                    if exc:
                        raise exc

    except (Exception, asyncio.CancelledError) as exc:  # surface API errors in the UI, then close
        if not isinstance(exc, asyncio.CancelledError):
            log.exception("voice session error")
            try:
                await _send_json(ws, {"type": "error", "message": str(exc)})
            except Exception:
                pass
    finally:
        stop.set()
        try:
            await ws.close()
        except Exception:
            pass
        log.info("session closed")
