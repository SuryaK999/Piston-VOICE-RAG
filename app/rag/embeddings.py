"""Embedding helpers.

The embed function is injectable so the retriever/graph can be tested
offline (no API key) with a deterministic stand-in — see scripts/test_offline.py.
"""
from __future__ import annotations

import logging
import time
import numpy as np
from google import genai
from google.genai import types

log = logging.getLogger("rag.embeddings")
EMBED_DIM = 768  # compact but plenty for a small KB; keeps FAISS tiny


_exhausted_models: set[str] = set()


def make_gemini_embedder(client: genai.Client, model: str):
    """Return embed(texts, task_type) -> (n, dim) float32 array, L2-normalised."""
    fallback_models = ["gemini-embedding-2", model, "gemini-embedding-2-preview", "gemini-embedding-001"]
    candidate_models = list(dict.fromkeys([m for m in fallback_models if m]))

    def _embed_batch(batch_texts: list[str], task_type: str, model_name: str) -> np.ndarray:
        # Crucial: in google-genai, passing a list of Content objects ensures
        # that EACH text chunk is embedded individually and returns its own vector!
        contents = [types.Content(parts=[types.Part.from_text(text=t)]) for t in batch_texts]
        resp = client.models.embed_content(
            model=model_name,
            contents=contents,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBED_DIM,
            ),
        )
        batch_vecs = np.array([e.values for e in resp.embeddings], dtype=np.float32)
        if batch_vecs.shape[0] != len(batch_texts):
            log.warning("Embedding count mismatch: expected %d, got %d", len(batch_texts), batch_vecs.shape[0])
        norms = np.linalg.norm(batch_vecs, axis=1, keepdims=True)
        return batch_vecs / np.clip(norms, 1e-12, None)

    def embed(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
        if not texts:
            return np.empty((0, EMBED_DIM), dtype=np.float32)

        all_vecs = []
        batch_size = 20  # Safe batch size to avoid request size & TPM overruns
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            if i > 0:
                time.sleep(0.3)  # Smooth cadence to respect Gemini rate limits
            
            embedded_batch = None
            last_err = None

            # Try candidate models with exponential backoff on transient errors
            for active_model in candidate_models:
                if active_model in _exhausted_models:
                    continue

                retries = 3
                for attempt in range(retries):
                    try:
                        embedded_batch = _embed_batch(batch, task_type, active_model)
                        break
                    except Exception as exc:
                        last_err = exc
                        err_str = str(exc).lower()
                        # If daily project quota is exceeded, mark model exhausted and switch immediately!
                        if "quota" in err_str or "per day limit exceeded" in err_str:
                            log.warning("Daily quota exhausted for %s. Skipping model.", active_model)
                            _exhausted_models.add(active_model)
                            break
                        # If transient rate limit (RPM), back off
                        elif "429" in err_str or "resource_exhausted" in err_str or "rate" in err_str:
                            wait_time = (attempt + 1) * 1.5
                            log.warning("Rate limit on %s (attempt %d/%d). Backing off %.1fs...",
                                        active_model, attempt + 1, retries, wait_time)
                            time.sleep(wait_time)
                        else:
                            # Other error (e.g. 404 model not found) -> try next candidate model
                            break

                if embedded_batch is not None:
                    break

            if embedded_batch is not None:
                all_vecs.append(embedded_batch)
            else:
                log.error("Failed to embed batch using Gemini API (%s). Falling back to local hash embeddings.", last_err)
                # Graceful offline fallback: ensure document upload and RAG never crash
                hash_embed = make_hash_embedder(EMBED_DIM)
                fallback_vecs = hash_embed(batch, task_type=task_type)
                all_vecs.append(fallback_vecs)

        return np.vstack(all_vecs) if all_vecs else np.empty((0, EMBED_DIM), dtype=np.float32)

    return embed


def make_hash_embedder(dim: int = EMBED_DIM):
    """Deterministic, dependency-free embedder for OFFLINE TESTS & FALLBACK.

    Guarantees every text chunk gets an L2-normalised float32 vector of exact dimension `dim`.
    """

    def embed(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
        if not texts:
            return np.empty((0, dim), dtype=np.float32)
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
