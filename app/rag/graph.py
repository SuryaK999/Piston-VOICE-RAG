from __future__ import annotations
import operator
from typing import Annotated, Callable, TypedDict

def _merge_dicts(a: dict, b: dict) -> dict:
    c = a.copy()
    c.update(b)
    return c

"""LangGraph RAG pipeline.

    rewrite ──► retrieve ──► grade ──┬─ relevant ─► synthesize
                                     └─ none ─────► no_answer

Why a graph (instead of one "search" function):
  * rewrite: spoken queries are messy ("uh what does it say about the deadline")
    — a rewrite step turns them into good retrieval queries.
  * grade:   the #1 failure mode of voice RAG is answering from
    irrelevant chunks. An explicit relevance gate lets the agent say
    "I don't have that information" instead of hallucinating.
  * synthesize: compresses chunks into a short, speakable answer
    (voice answers must be ~2-3 sentences, not a document dump).

Each node records a trace step so the UI can show what the agent did.
The LLM callable is injected, which keeps the graph testable offline.
"""

import time

from langgraph.graph import END, START, StateGraph

from .kb import Chunk
from .store import VectorStore

# An LLM callable: (prompt: str) -> str
LLMFn = Callable[[str], str]

TOP_K = 4
RELEVANCE_FLOOR = 0.35  # cosine floor before we even ask the LLM to grade


class RAGState(TypedDict, total=False):
    question: str                    # raw question from the voice agent
    query: str                       # rewritten retrieval query
    hits: list[tuple[int, float]]    # (chunk index, score)
    chunks: list[Chunk]              # resolved chunks
    verdict: str                     # "relevant" | "none"
    answer: str                      # speakable answer (or graceful not-found)
    sources: list[str]               # human-readable source labels
    trace: Annotated[list[str], operator.add]                 # step log for observability
    latency_ms: Annotated[dict, _merge_dicts]                 # per-node timings


def build_graph(store: VectorStore, embed_fn, llm: LLMFn):
    """Compile the RAG graph against a pre-built vector store."""

    def rewrite(state: RAGState) -> RAGState:
        t0 = time.perf_counter()
        prompt = (
            "Rewrite this spoken question into a short, keyword-rich search query "
            "for a document knowledge base. Output ONLY the query, no quotes.\n\n"
            f"Spoken question: {state['question']}"
        )
        query = llm(prompt).strip().strip('"') or state["question"]
        return {
            "query": query,
            "trace": [f"rewrite: \"{state['question']}\" → \"{query}\""],
            "latency_ms": {"rewrite": round((time.perf_counter() - t0) * 1000)},
        }

    def retrieve(state: RAGState) -> RAGState:
        t0 = time.perf_counter()
        results = store.search(state["query"], embed_fn, k=TOP_K)
        return {
            "chunks": [c for c, _ in results],
            "hits": [(i, s) for i, (c, s) in enumerate(results)],
            "trace": [
                "retrieve: " + ", ".join(f"{c.source_label} ({s:.2f})" for c, s in results)
            ],
            "latency_ms": {"retrieve": round((time.perf_counter() - t0) * 1000)},
        }

    def grade(state: RAGState) -> RAGState:
        t0 = time.perf_counter()
        best = max((s for _, s in state["hits"]), default=0.0)
        if best < RELEVANCE_FLOOR:
            verdict = "none"
        else:
            context = "\n\n".join(c.text for c in state["chunks"][:3])
            verdict = llm(
                "You are grading retrieved context for a question-answering system.\n"
                "Does the CONTEXT contain enough information to answer the QUESTION, "
                "even partially? Answer with exactly one word: YES or NO.\n\n"
                f"QUESTION: {state['question']}\n\nCONTEXT:\n{context}"
            ).strip().upper()
            verdict = "relevant" if verdict.startswith("YES") else "none"
        return {
            "verdict": verdict,
            "trace": [f"grade: {verdict} (best cosine {best:.2f})"],
            "latency_ms": {"grade": round((time.perf_counter() - t0) * 1000)},
        }

    def synthesize(state: RAGState) -> RAGState:
        t0 = time.perf_counter()
        context = "\n\n---\n\n".join(
            f"[Source: {c.source_label}]\n{c.text}" for c in state["chunks"]
        )
        answer = llm(
            "Answer the QUESTION using ONLY the CONTEXT below, in at most 3 short "
            "sentences, in plain spoken English (it will be read aloud by a voice "
            "agent — no markdown, no bullet points). If the context only partially "
            "answers the question, answer what you can and say what is missing.\n\n"
            f"QUESTION: {state['question']}\n\nCONTEXT:\n{context}"
        ).strip()
        sources = sorted({c.source_label for c in state["chunks"][:3]})
        return {
            "answer": answer,
            "sources": sources,
            "trace": [f"synthesize: answered from {', '.join(sources)}"],
            "latency_ms": {"synthesize": round((time.perf_counter() - t0) * 1000)},
        }

    def no_answer(state: RAGState) -> RAGState:
        return {
            "answer": (
                "I couldn't find that in the uploaded documents. "
                "Try uploading a relevant file first, or rephrase your question."
            ),
            "sources": [],
            "trace": ["no_answer: nothing relevant found — declining gracefully"],
            "latency_ms": {"synthesize": 0},
        }

    graph = StateGraph(RAGState)
    graph.add_node("rewrite", rewrite)
    graph.add_node("retrieve", retrieve)
    graph.add_node("grade", grade)
    graph.add_node("synthesize", synthesize)
    graph.add_node("no_answer", no_answer)
    graph.add_edge(START, "rewrite")
    graph.add_edge("rewrite", "retrieve")
    graph.add_edge("retrieve", "grade")
    graph.add_conditional_edges(
        "grade", lambda s: s["verdict"],
        {"relevant": "synthesize", "none": "no_answer"},
    )
    graph.add_edge("synthesize", END)
    graph.add_edge("no_answer", END)
    return graph.compile()


class RAGService:
    """Holds the compiled graph + store; one instance shared by all sessions."""

    def __init__(self, store: VectorStore, embed_fn, llm: LLMFn):
        self.store = store
        self.embed_fn = embed_fn
        self.graph = build_graph(store, embed_fn, llm)

    def ask(self, question: str) -> dict:
        """Run the full pipeline. Returns answer, sources, trace, latency."""
        final = self.graph.invoke({"question": question})
        return {
            "answer": final["answer"],
            "sources": final.get("sources", []),
            "trace": final.get("trace", []),
            "latency_ms": final.get("latency_ms", {}),
        }
