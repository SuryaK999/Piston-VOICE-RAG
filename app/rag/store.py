"""In-memory & persisted FAISS vector store (cosine search over L2-normalised vectors)."""
from __future__ import annotations

import json
from pathlib import Path
import faiss
import numpy as np

from .kb import Chunk


class VectorStore:
    def __init__(self, dim: int):
        self.dim = dim
        self.index = faiss.IndexFlatIP(dim)  # inner product on unit vectors = cosine
        self.chunks: list[Chunk] = []
        self.vectors: np.ndarray | None = None

    @classmethod
    def build(cls, chunks: list[Chunk], embed_fn) -> "VectorStore":
        texts = [f"{c.doc} - {c.section}\n{c.text}" for c in chunks]
        vecs = embed_fn(texts, task_type="RETRIEVAL_DOCUMENT").astype(np.float32)
        store = cls(dim=vecs.shape[1])
        store.index.add(vecs)
        store.chunks = list(chunks)
        store.vectors = vecs
        return store

    def add_chunks(self, chunks: list[Chunk], embed_fn) -> None:
        if not chunks:
            return
        texts = [f"{c.doc} - {c.section}\n{c.text}" for c in chunks]
        vecs = embed_fn(texts, task_type="RETRIEVAL_DOCUMENT").astype(np.float32)
        self.index.add(vecs)
        self.chunks.extend(chunks)
        if self.vectors is None:
            self.vectors = vecs
        else:
            self.vectors = np.vstack([self.vectors, vecs])

    def remove_document(self, doc_name: str) -> int:
        """Remove all chunks and vectors belonging to doc_name. Returns count of removed chunks."""
        if not self.chunks:
            return 0
        keep_indices = [i for i, c in enumerate(self.chunks) if c.doc != doc_name]
        removed_count = len(self.chunks) - len(keep_indices)
        if removed_count == 0:
            return 0

        self.chunks = [self.chunks[i] for i in keep_indices]
        self.index = faiss.IndexFlatIP(self.dim)
        if keep_indices and self.vectors is not None:
            self.vectors = self.vectors[keep_indices]
            self.index.add(self.vectors.astype(np.float32))
        else:
            self.vectors = None
        return removed_count

    def clear(self) -> None:
        """Clear all chunks and reset the vector index."""
        self.chunks = []
        self.vectors = None
        self.index = faiss.IndexFlatIP(self.dim)

    def search(
        self,
        query: str,
        embed_fn,
        k: int = 4,
        doc_filter: str | None = None,
    ) -> list[tuple[Chunk, float]]:
        if not self.chunks:
            return []
        q = embed_fn([query], task_type="RETRIEVAL_QUERY").astype(np.float32)

        # Context filter: restrict retrieval to a single specified document
        if doc_filter and self.vectors is not None:
            target_indices = [i for i, c in enumerate(self.chunks) if c.doc == doc_filter]
            if not target_indices:
                return []
            sub_index = faiss.IndexFlatIP(self.dim)
            sub_vecs = self.vectors[target_indices]
            sub_index.add(sub_vecs.astype(np.float32))
            scores, idxs = sub_index.search(q, min(k, len(target_indices)))
            return [
                (self.chunks[target_indices[i]], float(s))
                for i, s in zip(idxs[0], scores[0])
                if i >= 0
            ]

        scores, idxs = self.index.search(q, min(k, len(self.chunks)))
        return [
            (self.chunks[i], float(s))
            for i, s in zip(idxs[0], scores[0])
            if i >= 0
        ]

    def save(self, save_dir: Path) -> None:
        """Persist chunk metadata and raw vectors to disk."""
        save_dir.mkdir(parents=True, exist_ok=True)
        chunks_file = save_dir / "chunks.json"
        vectors_file = save_dir / "vectors.npy"

        raw_chunks = [
            {"doc": c.doc, "section": c.section, "text": c.text, "meta": c.meta}
            for c in self.chunks
        ]
        with open(chunks_file, "w", encoding="utf-8") as f:
            json.dump(raw_chunks, f, ensure_ascii=False, indent=2)

        if self.vectors is not None:
            np.save(vectors_file, self.vectors)
        elif vectors_file.exists():
            try:
                vectors_file.unlink()
            except Exception:
                pass

    @classmethod
    def load(cls, save_dir: Path, default_dim: int = 768) -> "VectorStore | None":
        """Load persisted chunks and vectors from disk into a ready FAISS index."""
        chunks_file = save_dir / "chunks.json"
        vectors_file = save_dir / "vectors.npy"
        if not chunks_file.exists() or not vectors_file.exists():
            return None
        try:
            with open(chunks_file, "r", encoding="utf-8") as f:
                raw_chunks = json.load(f)
            chunks = [Chunk(**c) for c in raw_chunks]
            vectors = np.load(vectors_file)
            store = cls(dim=vectors.shape[1] if vectors.ndim > 1 else default_dim)
            store.chunks = chunks
            store.vectors = vectors
            store.index.add(vectors.astype(np.float32))
            return store
        except Exception:
            return None
