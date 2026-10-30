"""FastAPI app: serves the UI and bridges browser WebSocket ↔ Gemini Live."""
from __future__ import annotations

import logging
import sys
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


def build_rag_service() -> RAGService:
    """Build the RAG service with an empty vector store (user uploads populate it)."""
    client = genai.Client(api_key=config.GOOGLE_API_KEY)
    embed_fn = make_gemini_embedder(client, config.EMBEDDING_MODEL)

    def llm(prompt: str) -> str:
        resp = client.models.generate_content(
            model=config.TEXT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return resp.text or ""

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

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if getattr(app.state, "rag", None) is None:
        return JSONResponse({"error": "RAG Service not initialized. Is GOOGLE_API_KEY set?"}, status_code=500)
    
    content = await file.read()
    if not content:
        return JSONResponse({"error": "Empty file."}, status_code=400)
    
    try:
        chunks = parse_document(file.filename or "upload.txt", content)
    except Exception as exc:
        log.exception("Failed to parse %s", file.filename)
        return JSONResponse({"error": f"Could not parse file: {exc}"}, status_code=400)
    
    if not chunks:
        return JSONResponse({"error": "No readable text found in the file."}, status_code=400)
    
    try:
        import asyncio
        await asyncio.to_thread(app.state.rag.store.add_chunks, chunks, app.state.rag.embed_fn)
        log.info("uploaded %s -> %d chunks", file.filename, len(chunks))
    except Exception as exc:
        log.exception("Failed to embed chunks for %s", file.filename)
        return JSONResponse({"error": f"Failed to embed document: {exc}"}, status_code=500)
    
    return {"message": f"Processed {len(chunks)} chunks from {file.filename}."}


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
