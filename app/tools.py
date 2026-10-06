"""Tool declarations and dispatch for the Gemini Live session.

One tool:
  search_knowledge_base — the full LangGraph RAG pipeline,
  searches through user-uploaded documents.
"""
from __future__ import annotations

from google.genai import types

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="search_knowledge_base",
        description=(
            "MANDATORY: You MUST call this tool whenever the user asks ANY question "
            "about their uploaded documents, resumes, or files. NEVER answer from "
            "general knowledge. ALWAYS search the knowledge base first to extract "
            "the specific details before formulating your response."
        ),
        parameters={
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The user's question, phrased clearly.",
                }
            },
            "required": ["question"],
        },
    ),
    types.FunctionDeclaration(
        name="end_session",
        description=(
            "Call this tool to end the current voice session immediately. "
            "Use this if the user says 'goodbye', 'stop', 'end call', or explicitly asks to end the conversation."
        ),
        parameters={"type": "object", "properties": {}},
    ),
]


async def dispatch_tool(name: str, args: dict, rag_service) -> tuple[dict, dict]:
    """Run a tool call. Returns (response_for_gemini, event_for_ui)."""
    if name == "search_knowledge_base":
        import asyncio

        question = args.get("question", "")
        result = await asyncio.to_thread(rag_service.ask, question)
        response = {
            "answer": result["answer"],
            "sources": result["sources"],
        }
        ui_event = {
            "type": "tool",
            "name": name,
            "detail": question,
            "trace": result["trace"],
            "latency_ms": result["latency_ms"],
            "sources": result["sources"],
        }
        return response, ui_event

    if name == "end_session":
        return {"success": True}, {
            "type": "tool",
            "name": name,
            "detail": "Ending session by user request",
            "status": "done",
            "end_session": True
        }

    return {"error": f"unknown tool: {name}"}, {
        "type": "tool", "name": name, "detail": "unknown tool", "trace": [],
        "latency_ms": {}, "sources": [],
    }
