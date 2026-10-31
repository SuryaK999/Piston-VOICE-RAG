from __future__ import annotations
import operator
import re
import time
from typing import Annotated, Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from .kb import Chunk
from .store import VectorStore, _clean_doc_string

def _merge_dicts(a: dict, b: dict) -> dict:
    c = a.copy()
    c.update(b)
    return c

"""LangGraph RAG pipeline.

    rewrite -> retrieve -> grade -+- relevant -> synthesize
                                  +- none     -> no_answer

Why a graph (instead of one "search" function):
  * rewrite: spoken queries are messy ("uh what does it say about the deadline")
    - a rewrite step turns them into good retrieval queries.
  * grade:   the #1 failure mode of voice RAG is answering from
    irrelevant chunks. An explicit relevance gate lets the agent say
    "I don't have that information" instead of hallucinating.
  * synthesize: compresses chunks into a short, speakable answer
    (voice answers must be ~2-3 sentences, not a document dump).

Each node records a trace step so the UI can show what the agent did.
The LLM callable is injected, which keeps the graph testable offline.
"""

# An LLM callable: (prompt: str) -> str
LLMFn = Callable[[str], str]

TOP_K = 4
RELEVANCE_FLOOR = 0.35  # cosine floor before we even ask the LLM to grade


class RAGState(TypedDict, total=False):
    question: str                    # raw question from the voice agent
    query: str                       # rewritten retrieval query
    doc_filter: str | None           # optional document filter
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
        question = state.get("question", "").strip()
        q_lower = question.lower()

        # Meta-query check: do not mangle questions asking for file inventory
        meta_phrases = [
            "list all", "what documents", "what files", "which documents",
            "which files", "do you see my files", "can you see the documents",
            "show all files", "uploaded files", "uploaded documents"
        ]
        if any(p in q_lower for p in meta_phrases) and not any(k in q_lower for k in ["inside", "within", "content", "explain", "detail"]):
            return {
                "query": question,
                "trace": [f"rewrite: meta-query detected: \"{question}\""],
                "latency_ms": {"rewrite": 0},
            }

        prompt = (
            "Rewrite this spoken question into a short, keyword-rich search query "
            "for a document knowledge base. Output ONLY the query, no quotes.\n\n"
            f"Spoken question: {question}"
        )
        query = llm(prompt).strip().strip('"') or question
        return {
            "query": query,
            "trace": [f"rewrite: \"{question}\" -> \"{query}\""],
            "latency_ms": {"rewrite": round((time.perf_counter() - t0) * 1000)},
        }

    def retrieve(state: RAGState) -> RAGState:
        t0 = time.perf_counter()
        doc_filter = state.get("doc_filter")
        question = state.get("question", "")
        q_lower = question.lower()

        # 1. Handle meta-queries (listing files)
        meta_phrases = [
            "list all", "what documents", "what files", "which documents",
            "which files", "do you see my files", "can you see the documents",
            "show all files", "uploaded files", "uploaded documents"
        ]
        if any(p in q_lower for p in meta_phrases) and not any(k in q_lower for k in ["inside", "within", "content", "explain", "detail"]):
            inv = store.get_document_inventory()
            chunks = []
            for d in inv:
                chunks.append(Chunk(
                    doc=d["name"],
                    section="Document Metadata",
                    text=f"Uploaded Document: {d['name']} ({d['chunks_count']} indexed sections, {d['total_chars']} characters)"
                ))
            return {
                "chunks": chunks,
                "hits": [(i, 1.0) for i in range(len(chunks))],
                "trace": [f"retrieve: direct document inventory ({len(chunks)} docs)"],
                "latency_ms": {"retrieve": 1},
            }

        # 2. Resolve document filter (either from state or extracted from question)
        resolved_doc = store.resolve_document_name(doc_filter) if doc_filter else None
        if not resolved_doc:
            inv = store.get_document_inventory()
            for d in inv:
                d_name = d["name"]
                if _clean_doc_string(d_name) and _clean_doc_string(d_name) in _clean_doc_string(question):
                    resolved_doc = d_name
                    break

        # 3. Direct document summarization bypass
        is_summary = any(w in q_lower for w in ["summarize", "summary", "overview", "what is this", "explain", "outline", "about"])
        if resolved_doc and is_summary:
            doc_chunks = store.get_document_chunks(resolved_doc)
            if doc_chunks:
                selected_chunks = doc_chunks[:TOP_K]
                return {
                    "chunks": selected_chunks,
                    "hits": [(i, 1.0) for i in range(len(selected_chunks))],
                    "trace": [f"retrieve: direct summary chunks for {resolved_doc} ({len(selected_chunks)} chunks)"],
                    "latency_ms": {"retrieve": 1},
                }

        # 4. Standard semantic search
        results = store.search(state["query"], embed_fn, k=TOP_K, doc_filter=resolved_doc)
        filter_str = f" [filter: {resolved_doc}]" if resolved_doc else ""
        return {
            "chunks": [c for c, _ in results],
            "hits": [(i, s) for i, (c, s) in enumerate(results)],
            "trace": [
                f"retrieve{filter_str}: " + (", ".join(f"{c.source_label} ({s:.2f})" for c, s in results) if results else "no matching chunks")
            ],
            "latency_ms": {"retrieve": round((time.perf_counter() - t0) * 1000)},
        }

    def grade(state: RAGState) -> RAGState:
        t0 = time.perf_counter()
        chunks = state.get("chunks", [])
        if not chunks:
            return {
                "verdict": "none",
                "trace": ["grade: none (0 chunks retrieved)"],
                "latency_ms": {"grade": 0},
            }

        best = max((s for _, s in state.get("hits", [])), default=0.0)
        doc_filter = state.get("doc_filter")

        # Automatically relevant if direct document target matched or meta-query hit
        if best >= 0.99 or (doc_filter and len(chunks) > 0):
            return {
                "verdict": "relevant",
                "trace": [f"grade: relevant (direct match / targeted doc: {best:.2f})"],
                "latency_ms": {"grade": 1},
            }

        if best < 0.25:
            verdict = "none"
        else:
            context = "\n\n".join(c.text for c in chunks[:3])
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
            "agent - no markdown, no bullet points). If the context only partially "
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
        inv = store.get_document_inventory()
        if inv:
            file_names = ", ".join(d["name"] for d in inv)
            doc_filter = state.get("doc_filter")
            if doc_filter:
                msg = f"I searched inside {doc_filter}, but could not find specific details answering that question. You also have {file_names} available."
            else:
                msg = f"I searched your uploaded files ({file_names}), but couldn't find details directly answering that. Please ask about specific topics in these files."
        else:
            msg = "I do not see any uploaded files in the knowledge base right now. Please upload a file to get started."

        return {
            "answer": msg,
            "sources": [],
            "trace": ["no_answer: informative decline with file awareness"],
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

    def ask(self, question: str, doc_filter: str | None = None) -> dict:
        """Run the full pipeline. Returns answer, sources, trace, latency."""
        payload = {"question": question}
        if doc_filter:
            payload["doc_filter"] = doc_filter
        final = self.graph.invoke(payload)
        return {
            "answer": final["answer"],
            "sources": final.get("sources", []),
            "trace": final.get("trace", []),
            "latency_ms": final.get("latency_ms", {}),
        }
