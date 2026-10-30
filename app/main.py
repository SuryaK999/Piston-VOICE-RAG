"""FastAPI app: serves the UI and bridges browser WebSocket ↔ Gemini Live."""
from __future__ import annotations

import json
import logging
import sys
import urllib.parse
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

from . import config
from .live_session import handle_voice_session
from .rag.embeddings import make_gemini_embedder
from .rag.graph import RAGService
from .rag.kb import parse_document
from .rag.store import VectorStore
from .rag.embeddings import EMBED_DIM

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("main")

STATIC_DIR = Path(__file__).parent.parent / "static"
DATA_DIR = Path(__file__).parent.parent / "data"
STORE_DIR = DATA_DIR / "vector_store"
DOCS_FILE = DATA_DIR / "documents.json"
UPLOADS_DIR = DATA_DIR / "uploads"


def get_documents_meta() -> list[dict]:
    if DOCS_FILE.exists():
        try:
            with open(DOCS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def save_documents_meta(docs: list[dict]) -> None:
    DOCS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DOCS_FILE, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)


def build_rag_service() -> RAGService:
    """Build the RAG service, loading persisted vector store from disk if available."""
    client = genai.Client(api_key=config.GOOGLE_API_KEY)
    embed_fn = make_gemini_embedder(client, config.EMBEDDING_MODEL)

    def llm(prompt: str) -> str:
        resp = client.models.generate_content(
            model=config.TEXT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return resp.text or ""

    store = VectorStore.load(STORE_DIR, default_dim=EMBED_DIM)
    if store is not None and len(store.chunks) > 0:
        log.info("loaded persisted vector store from %s (%d chunks)", STORE_DIR, len(store.chunks))
    else:
        store = VectorStore(dim=EMBED_DIM)
        log.info("empty vector store created (dim=%d) - upload documents to populate", EMBED_DIM)

    return RAGService(store, embed_fn, llm)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.GOOGLE_API_KEY:
        log.warning("GOOGLE_API_KEY is not set - voice sessions will fail. "
                    "Copy .env.example to .env and add your key.")
        app.state.rag = None
    else:
        import asyncio
        app.state.rag = await asyncio.to_thread(build_rag_service)
    yield


app = FastAPI(title="Voice RAG Agent", lifespan=lifespan)


@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
async def health():
    return JSONResponse({
        "ok": True,
        "kb_ready": getattr(app.state, "rag", None) is not None,
        "live_model": config.LIVE_MODEL,
    })


@app.get("/documents")
async def list_documents():
    """List all currently loaded documents with persistence across page refreshes."""
    docs = get_documents_meta()
    if getattr(app.state, "rag", None) is not None:
        loaded_names = {c.doc for c in app.state.rag.store.chunks}
        if not docs and loaded_names:
            docs = [
                {
                    "id": f"doc-{name}",
                    "name": name,
                    "size": 0,
                    "chunks_count": sum(1 for c in app.state.rag.store.chunks if c.doc == name),
                    "parsed": True,
                }
                for name in sorted(loaded_names)
            ]
            save_documents_meta(docs)
        elif docs:
            docs = [d for d in docs if d.get("name") in loaded_names]
            save_documents_meta(docs)
    return JSONResponse(docs)


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if getattr(app.state, "rag", None) is None:
        return JSONResponse({"error": "RAG Service not initialized. Is GOOGLE_API_KEY set?"}, status_code=500)
    
    content = await file.read()
    if not content:
        return JSONResponse({"error": "Empty file."}, status_code=400)
    
    filename = file.filename or "upload.txt"
    try:
        chunks = parse_document(filename, content)
    except Exception as exc:
        log.exception("Failed to parse %s", filename)
        return JSONResponse({"error": f"Could not parse file: {exc}"}, status_code=400)
    
    if not chunks:
        return JSONResponse({"error": "No readable text found in the file."}, status_code=400)
    
    try:
        import asyncio

        # Save uploaded file to disk
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        file_path = UPLOADS_DIR / filename
        with open(file_path, "wb") as f:
            f.write(content)

        # If re-uploading, replace previous chunks
        app.state.rag.store.remove_document(filename)

        # Add to vector store and persist
        await asyncio.to_thread(app.state.rag.store.add_chunks, chunks, app.state.rag.embed_fn)
        app.state.rag.store.save(STORE_DIR)

        # Update metadata file
        docs = [d for d in get_documents_meta() if d.get("name") != filename]
        doc_entry = {
            "id": f"doc-{filename}",
            "name": filename,
            "size": len(content),
            "chunks_count": len(chunks),
            "parsed": True,
        }
        docs.append(doc_entry)
        save_documents_meta(docs)

        log.info("uploaded %s -> %d chunks (persisted to %s)", filename, len(chunks), STORE_DIR)
        return JSONResponse({
            "message": f"Processed and indexed {len(chunks)} chunks from {filename}.",
            "doc": doc_entry,
            "documents": docs,
        })
    except Exception as exc:
        log.exception("Failed to embed chunks for %s", filename)
        return JSONResponse({"error": f"Failed to embed document: {exc}"}, status_code=500)


@app.delete("/documents/{doc_name:path}")
async def delete_document(doc_name: str):
    """Remove a document from the vector store and disk."""
    if getattr(app.state, "rag", None) is None:
        return JSONResponse({"error": "RAG Service not initialized."}, status_code=500)

    decoded_name = urllib.parse.unquote(doc_name)
    removed_chunks = app.state.rag.store.remove_document(decoded_name)
    app.state.rag.store.save(STORE_DIR)

    # Remove raw file from uploads
    file_path = UPLOADS_DIR / decoded_name
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass

    # Update metadata
    docs = [d for d in get_documents_meta() if d.get("name") != decoded_name]
    save_documents_meta(docs)

    log.info("removed document %s (%d chunks removed)", decoded_name, removed_chunks)
    return JSONResponse({
        "success": True,
        "message": f"Document '{decoded_name}' removed.",
        "removed_chunks": removed_chunks,
        "documents": docs,
    })


@app.delete("/documents")
async def clear_all_documents():
    """Clear all documents from the knowledge base."""
    if getattr(app.state, "rag", None) is None:
        return JSONResponse({"error": "RAG Service not initialized."}, status_code=500)

    app.state.rag.store.clear()
    app.state.rag.store.save(STORE_DIR)

    if UPLOADS_DIR.exists():
        for item in UPLOADS_DIR.iterdir():
            if item.is_file():
                try:
                    item.unlink()
                except Exception:
                    pass

    save_documents_meta([])
    log.info("cleared all documents from knowledge base")
    return JSONResponse({
        "success": True,
        "message": "All documents removed from knowledge base.",
        "documents": [],
    })


@app.websocket("/ws")
async def voice_ws(websocket: WebSocket):
    if getattr(app.state, "rag", None) is None:
        await websocket.accept()
        await websocket.send_text(
            '{"type": "error", "message": "GOOGLE_API_KEY not configured on server."}'
        )
        await websocket.close()
        return
    await handle_voice_session(websocket, app.state.rag)
