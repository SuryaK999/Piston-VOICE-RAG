"""Tool declarations and dispatch for the Gemini Live session.

Tools:
  search_knowledge_base - the full LangGraph RAG pipeline, searches through user-uploaded documents.
  list_uploaded_documents - returns the current inventory of uploaded documents in the knowledge base.
  end_session - ends the current voice session.
"""
from __future__ import annotations

from google.genai import types

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="search_knowledge_base",
        description=(
            "MANDATORY: Call this tool whenever the user asks ANY question about the content, "
            "facts, structure, details, summary, or analysis of their uploaded documents or files. "
            "NEVER guess document content. ALWAYS search the knowledge base first. "
            "You may optionally pass 'doc' to restrict the search to a specific document name."
        ),
        parameters={
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The user's question, phrased clearly.",
                },
                "doc": {
                    "type": "string",
                    "description": "Optional specific document filename (e.g. 'project-structure.txt', 'README.md').",
                },
            },
            "required": ["question"],
        },
    ),
    types.FunctionDeclaration(
        name="list_uploaded_documents",
        description=(
            "Call this tool to get the current list of all uploaded documents in the session, "
            "including their filenames, section counts, and the currently focused document. "
            "Call this whenever the user asks what documents are uploaded, what you can see, "
            "or what files exist in the knowledge base."
        ),
        parameters={"type": "object", "properties": {}},
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


async def dispatch_tool(
    name: str, args: dict, rag_service, doc_filter: str | None = None
) -> tuple[dict, dict]:
    """Run a tool call. Returns (response_for_gemini, event_for_ui)."""
    if name == "list_uploaded_documents":
        inventory = rag_service.store.get_document_inventory() if hasattr(rag_service, "store") else []
        file_names = [d["name"] for d in inventory]
        active = doc_filter or "Everything (All Documents)"
        response = {
            "total_documents": len(inventory),
            "documents": inventory,
            "active_selection": active,
            "answer": (
                f"There are {len(inventory)} document(s) uploaded: {', '.join(file_names)}. "
                f"Currently focused on: {active}."
            ) if inventory else "No documents uploaded yet.",
        }
        ui_event = {
            "type": "tool",
            "name": name,
            "detail": f"Checked uploaded files ({len(inventory)} files in KB)",
            "trace": [f"list_uploaded_documents: {', '.join(file_names) if file_names else 'No documents'}"],
            "latency_ms": {"inventory": 1},
            "sources": file_names,
        }
        return response, ui_event

    if name == "search_knowledge_base":
        import asyncio

        question = args.get("question", "")
        requested_doc = args.get("doc")

        # Fuzzily resolve requested doc if provided
        resolved_requested = None
        if requested_doc and hasattr(rag_service, "store"):
            resolved_requested = rag_service.store.resolve_document_name(requested_doc)

        # Prioritize resolved requested doc; otherwise fall back to UI doc_filter
        filter_to_use = resolved_requested or doc_filter

        result = await asyncio.to_thread(rag_service.ask, question, filter_to_use)
        response = {
            "answer": result["answer"],
            "sources": result["sources"],
        }
        ui_event = {
            "type": "tool",
            "name": name,
            "detail": f"{question} [{filter_to_use}]" if filter_to_use else question,
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
            "end_session": True,
        }

    return {"error": f"unknown tool: {name}"}, {
        "type": "tool",
        "name": name,
        "detail": "unknown tool",
        "trace": [],
        "latency_ms": {},
        "sources": [],
    }
