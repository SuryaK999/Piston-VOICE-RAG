"""Full RAG test against the real Gemini API (needs GOOGLE_API_KEY in .env).

Text-only — exercises the exact LangGraph pipeline the voice agent uses,
so you can validate retrieval quality before opening the browser.

Run:  python scripts/test_rag_live.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import build_rag_service
from app.rag.kb import parse_document

SAMPLE_DOC = """# Company Leave Policy

## Annual Leave
Full-time employees are entitled to 24 days of paid annual leave per year.
Leave must be approved by the reporting manager at least 3 business days in advance.

## Sick Leave
Employees receive 12 days of sick leave per year. A medical certificate is
required for absences exceeding 2 consecutive days.

## Work From Home
Employees may work from home up to 2 days per week with manager approval.
Remote work must be logged in the HR portal by 9 AM.

## Notice Period
The standard notice period is 60 days for all full-time employees.
Early release may be granted at management discretion with a salary adjustment.
"""

QUESTIONS = [
    "How many days of annual leave do I get?",
    "Do I need a doctor's note for sick leave?",
    "Can I work from home?",
    "What is the notice period?",
    "What's the dress code?",  # not in doc → should gracefully decline
]


def main():
    print("Building RAG service…")
    rag = build_rag_service()

    # Simulate uploading a document
    print("Uploading sample document…")
    chunks = parse_document("leave_policy.md", SAMPLE_DOC.encode("utf-8"))
    rag.store.add_chunks(chunks, rag.embed_fn)
    print(f"OK — {rag.store.index.ntotal} chunks indexed\n")

    for q in QUESTIONS:
        out = rag.ask(q)
        print(f"Q: {q}")
        print(f"A: {out['answer']}")
        print(f"   sources: {out['sources']}")
        total = sum(out["latency_ms"].values())
        print(f"   latency: {total} ms  {out['latency_ms']}")
        for step in out["trace"]:
            print(f"   · {step}")
        print()


if __name__ == "__main__":
    main()
