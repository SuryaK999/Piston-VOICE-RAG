"""In-memory FAISS vector store (cosine search over L2-normalised vectors)."""
from __future__ import annotations

import faiss
import numpy as np

from .kb import Chunk


class VectorStore:
    def __init__(self, dim: int):
        self.index = faiss.IndexFlatIP(dim)  # inner product on unit vectors = cosine
        self.chunks: list[Chunk] = []

    @classmethod
    def build(cls, chunks: list[Chunk], embed_fn) -> "VectorStore":
        texts = [f"{c.doc} — {c.section}\n{c.text}" for c in chunks]
        vecs = embed_fn(texts, task_type="RETRIEVAL_DOCUMENT")
        store = cls(dim=vecs.shape[1])
        store.index.add(vecs.astype(np.float32))
        store.chunks = chunks
        return store

    def add_chunks(self, chunks: list[Chunk], embed_fn) -> None:
        if not chunks:
            return
        texts = [f"{c.doc} — {c.section}\n{c.text}" for c in chunks]
        vecs = embed_fn(texts, task_type="RETRIEVAL_DOCUMENT")
        self.index.add(vecs.astype(np.float32))
        self.chunks.extend(chunks)

    def search(self, query: str, embed_fn, k: int = 4) -> list[tuple[Chunk, float]]:
        if not self.chunks:
            return []
        q = embed_fn([query], task_type="RETRIEVAL_QUERY").astype(np.float32)
        scores, idxs = self.index.search(q, min(k, len(self.chunks)))
        return [
            (self.chunks[i], float(s))
            for i, s in zip(idxs[0], scores[0])
            if i >= 0
        ]
