"""In-memory & persisted FAISS vector store (cosine search over L2-normalised vectors)."""
from __future__ import annotations

import json
import re
from pathlib import Path
import faiss
import numpy as np

from .kb import Chunk


def _clean_doc_string(s: str) -> str:
    """Normalize a document name or spoken reference for fuzzy comparison."""
    s = s.lower()
    # Remove spoken extension terms like 'dot txt', 'dot pdf', 'dot md'
    s = re.sub(r'\bdot\s+[a-z0-9]{2,4}\b', '', s)
    # Remove extension
    s = re.sub(r'\.[a-z0-9]{2,4}$', '', s)
    # Keep only alphanumeric characters
    return re.sub(r'[^a-z0-9]', '', s)


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
        if vecs.shape[0] != len(chunks):
            chunks = chunks[:vecs.shape[0]]
        if not chunks or vecs.shape[0] == 0:
            return
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
            valid_keep = [i for i in keep_indices if i < len(self.vectors)]
            if valid_keep:
                self.vectors = self.vectors[valid_keep]
                self.index.add(self.vectors.astype(np.float32))
            else:
                self.vectors = None
        else:
            self.vectors = None
        return removed_count

    def clear(self) -> None:
        """Clear all chunks and reset the vector index."""
        self.chunks = []
        self.vectors = None
        self.index = faiss.IndexFlatIP(self.dim)

    def get_document_inventory(self) -> list[dict]:
        """Return a structured summary of all documents in the store."""
        docs = sorted({c.doc for c in self.chunks})
        return [
            {
                "name": doc,
                "chunks_count": sum(1 for c in self.chunks if c.doc == doc),
                "total_chars": sum(len(c.text) for c in self.chunks if c.doc == doc),
            }
            for doc in docs
        ]

    def resolve_document_name(self, name_or_query: str | None) -> str | None:
        """Fuzzily resolve spoken document references to the real document filename."""
        if not name_or_query or not self.chunks:
            return None
        
        name_or_query = name_or_query.strip()
        available_docs = sorted({c.doc for c in self.chunks})
        
        # 1. Exact match
        if name_or_query in available_docs:
            return name_or_query
        
        # 2. Case-insensitive match
        lower_map = {d.lower(): d for d in available_docs}
        if name_or_query.lower() in lower_map:
            return lower_map[name_or_query.lower()]
        
        # 3. Cleaned alphanumeric match (handles 'project structure dot t x t' -> 'project-structure.txt')
        target_clean = _clean_doc_string(name_or_query)
        if target_clean:
            for d in available_docs:
                if _clean_doc_string(d) == target_clean:
                    return d
                
            # 4. Cleaned substring match
            for d in available_docs:
                d_clean = _clean_doc_string(d)
                if target_clean in d_clean or d_clean in target_clean:
                    return d

        # 5. Word overlap
        target_words = set(re.findall(r'[a-z0-9]+', name_or_query.lower()))
        target_words.difference_update({"dot", "txt", "pdf", "md", "doc", "document", "file", "the", "a", "an"})
        
        best_doc = None
        best_overlap = 0
        for d in available_docs:
            d_words = set(re.findall(r'[a-z0-9]+', d.lower()))
            overlap = len(target_words & d_words)
            if overlap > best_overlap:
                best_overlap = overlap
                best_doc = d
                
        if best_overlap > 0:
            return best_doc

        return None

    def get_document_chunks(self, doc_name: str) -> list[Chunk]:
        """Retrieve all chunks belonging to a document."""
        resolved = self.resolve_document_name(doc_name) or doc_name
        return [c for c in self.chunks if c.doc == resolved]

    def search(
        self,
        query: str,
        embed_fn,
        k: int = 4,
        doc_filter: str | None = None,
    ) -> list[tuple[Chunk, float]]:
        if not self.chunks:
            return []

        # Fuzzily resolve doc_filter if provided
        resolved_doc = None
        if doc_filter:
            resolved_doc = self.resolve_document_name(doc_filter)
            if not resolved_doc:
                return []

        # If a specific document is requested
        if resolved_doc and self.vectors is not None:
            target_indices = [i for i, c in enumerate(self.chunks) if c.doc == resolved_doc]
            if target_indices:
                # If document is small (<= k chunks), return all its chunks directly
                if len(target_indices) <= k:
                    return [(self.chunks[i], 1.0) for i in target_indices]

                q = embed_fn([query], task_type="RETRIEVAL_QUERY").astype(np.float32)
                sub_index = faiss.IndexFlatIP(self.dim)
                sub_vecs = self.vectors[target_indices]
                sub_index.add(sub_vecs.astype(np.float32))
                scores, idxs = sub_index.search(q, min(k, len(target_indices)))
                return [
                    (self.chunks[target_indices[i]], float(s))
                    for i, s in zip(idxs[0], scores[0])
                    if i >= 0
                ]

        # Global search across all documents
        q = embed_fn([query], task_type="RETRIEVAL_QUERY").astype(np.float32)
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
