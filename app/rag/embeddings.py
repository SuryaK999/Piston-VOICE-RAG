"""Embedding helpers.

The embed function is injectable so the retriever/graph can be tested
offline (no API key) with a deterministic stand-in — see scripts/test_offline.py.
"""
from __future__ import annotations

import numpy as np
from google import genai
from google.genai import types

EMBED_DIM = 768  # compact but plenty for a small KB; keeps FAISS tiny


def make_gemini_embedder(client: genai.Client, model: str):
    """Return embed(texts, task_type) -> (n, dim) float32 array, L2-normalised."""

    def embed(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
        all_vecs = []
        batch_size = 50
        
        import time
        for i in range(0, len(texts), batch_size):
            if i > 0:
                time.sleep(1.0) # Respect rate limits
                
            batch = texts[i : i + batch_size]
            resp = client.models.embed_content(
                model=model,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=EMBED_DIM,
                ),
            )
            batch_vecs = np.array([e.values for e in resp.embeddings], dtype=np.float32)
            norms = np.linalg.norm(batch_vecs, axis=1, keepdims=True)
            batch_normalized = batch_vecs / np.clip(norms, 1e-12, None)
            all_vecs.append(batch_normalized)
            
        return np.vstack(all_vecs) if all_vecs else np.empty((0, EMBED_DIM), dtype=np.float32)

    return embed


def make_hash_embedder(dim: int = EMBED_DIM):
    """Deterministic, dependency-free embedder for OFFLINE TESTS ONLY.

    Not semantically meaningful — identical texts get identical vectors,
    which is exactly what the plumbing tests need.
    """

    def embed(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
        rng_seed = np.fromiter(
            (hash((task_type, t)) & 0xFFFFFFFF for t in texts), dtype=np.uint32
        )
        out = np.empty((len(texts), dim), dtype=np.float32)
        for i, seed in enumerate(rng_seed):
            rng = np.random.default_rng(int(seed))
            v = rng.standard_normal(dim).astype(np.float32)
            out[i] = v / np.linalg.norm(v)
        return out

    return embed
