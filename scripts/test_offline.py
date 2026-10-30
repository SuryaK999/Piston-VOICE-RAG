"""Offline plumbing test -- NO API key needed.

Validates: document parsing, FAISS store, LangGraph wiring (with stub LLM +
deterministic hash embeddings), document removal, filtering, and persistence.
Run:  python scripts/test_offline.py
"""
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.rag.embeddings import make_hash_embedder, EMBED_DIM
from app.rag.graph import RAGService
from app.rag.kb import Chunk, parse_document
from app.rag.store import VectorStore

passed = failed = 0


def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  [OK] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} {extra}")


# ---- Document parsing ----
print("== Document parsing ==")
sample_md = b"""# Test Document

This is an overview paragraph.

## Section A

Content of section A with some details.

## Section B

Content of section B with other details.
"""
chunks = parse_document("test.md", sample_md)
check("chunks parsed", len(chunks) >= 3, f"(got {len(chunks)})")
check("every chunk has a source label", all(c.source_label for c in chunks))
sections = {c.section for c in chunks}
check("sections split correctly", "Section A" in sections and "Section B" in sections,
      f"(got {sections})")

print("== Plain text fallback ==")
plain_text = b"This is plain text content.\n\nSecond paragraph here."
txt_chunks = parse_document("notes.txt", plain_text)
check("plain text parsed", len(txt_chunks) >= 1, f"(got {len(txt_chunks)})")

# ---- Vector store ----
print("== Vector store ==")
embed = make_hash_embedder()
store = VectorStore.build(chunks, embed)
check("index size matches chunks", store.index.ntotal == len(chunks))
check("chunks list matches", len(store.chunks) == len(chunks))

# hash embeddings: identical text string must retrieve itself
probe = chunks[0]
query_text = f"{probe.doc} - {probe.section}\n{probe.text}"
hits = store.search(query_text, embed, k=1)
check("search returns results", len(hits) >= 1)

# ---- Dynamic add_chunks ----
print("== Dynamic add_chunks ==")
before = store.index.ntotal
new_chunks = [Chunk(doc="extra.md", section="Extra", text="Extra content here")]
store.add_chunks(new_chunks, embed)
check("index grew by 1", store.index.ntotal == before + 1)
check("chunk list grew", len(store.chunks) == before + 1)

# ---- Document filtering ----
print("== Document filtering ==")
doc_hits = store.search("Extra content here", embed, k=5, doc_filter="extra.md")
check("filtered search returns target document", all(c.doc == "extra.md" for c, _ in doc_hits))
non_existent = store.search("Extra content here", embed, k=5, doc_filter="non_existent.md")
check("filtered search with non-existent doc returns empty", len(non_existent) == 0)

# ---- Document removal ----
print("== Document removal ==")
removed_count = store.remove_document("extra.md")
check("removed correct chunk count", removed_count == 1)
check("store size reverted", store.index.ntotal == before)
check("removed doc no longer in store", all(c.doc != "extra.md" for c in store.chunks))

# ---- Persistence (Save & Load) ----
print("== Persistence (Save & Load) ==")
temp_dir = Path(tempfile.mkdtemp())
try:
    store.save(temp_dir)
    loaded_store = VectorStore.load(temp_dir, default_dim=EMBED_DIM)
    check("loaded store exists", loaded_store is not None)
    check("loaded store index size matches", loaded_store.index.ntotal == store.index.ntotal)
    check("loaded store chunks count matches", len(loaded_store.chunks) == len(store.chunks))
    loaded_hits = loaded_store.search(query_text, embed, k=1)
    check("loaded store search works", len(loaded_hits) >= 1)
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)

# ---- Empty store ----
print("== Empty store ==")
empty = VectorStore(dim=EMBED_DIM)
check("empty store has 0 vectors", empty.index.ntotal == 0)
check("empty store has 0 chunks", len(empty.chunks) == 0)
empty.add_chunks([], embed)
check("add_chunks with [] is no-op", empty.index.ntotal == 0)

# ---- LangGraph wiring ----
print("== LangGraph wiring (stub LLM) ==")

def stub_llm(prompt: str) -> str:
    if "grading retrieved context" in prompt:
        return "YES"
    if "Rewrite this spoken question" in prompt:
        return "stub query"
    return "stub spoken answer about the document"


rag = RAGService(store, embed, stub_llm)
out = rag.ask("what does section A say?")
check("graph returns an answer string", isinstance(out["answer"], str) and len(out["answer"]) > 0)
check("trace is a list", isinstance(out["trace"], list) and len(out["trace"]) > 0)
check("latency_ms is a dict", isinstance(out["latency_ms"], dict))
check("sources is a list", isinstance(out["sources"], list))

# with doc filter
out_filtered = rag.ask("what does section A say?", doc_filter="test.md")
check("filtered ask works", isinstance(out_filtered["answer"], str))

def no_llm(prompt: str) -> str:
    return "NO" if "grading" in prompt else "x"


rag_no = RAGService(store, embed, no_llm)
out_no = rag_no.ask("something completely unrelated")
check("irrelevant -> graceful no_answer", "couldn't find" in out_no["answer"])
check("no_answer has empty sources", out_no["sources"] == [])

# ---- Tools ----
print("== Tools ==")
from app.tools import TOOL_DECLARATIONS

check("two tools declared", len(TOOL_DECLARATIONS) == 2)
check("tool is search_knowledge_base", TOOL_DECLARATIONS[0].name == "search_knowledge_base")

print(f"\n{passed} passed, {failed} failed")
if __name__ == "__main__":
    sys.exit(1 if failed else 0)
