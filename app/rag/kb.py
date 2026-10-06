"""Document parsing and chunking.

Text and PDF documents are split on section headers (or paragraph breaks)
so each chunk is a self-contained topic for good retrieval granularity.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


@dataclass
class Chunk:
    doc: str        # source file name, e.g. "report.pdf"
    section: str    # section title, e.g. "Overview"
    text: str       # full chunk text (header + body)
    meta: dict = field(default_factory=dict)

    @property
    def source_label(self) -> str:
        return f"{self.doc} › {self.section}"


def _split_markdown(doc_name: str, content: str) -> list[Chunk]:
    """Split a document into one chunk per '##' section.

    Content before the first '##' becomes its own chunk.
    Oversized sections are further split on paragraph breaks.
    Plain-text documents (no headers) are split on double-newlines.
    """
    chunks: list[Chunk] = []
    content = content.strip()
    if not content:
        return chunks

    parts = re.split(r"(?m)^(#{1,2})\s+(.+)$", content)
    # parts = [pre, '#', 'Title', body, '##', 'Section', body, ...]
    if parts[0].strip():
        pre = parts[0].strip()
        if len(pre) <= 1200:
            chunks.append(Chunk(doc=doc_name, section="Overview", text=pre))
        else:
            for j, para in enumerate(re.split(r"\n\s*\n", pre)):
                if para.strip():
                    chunks.append(
                        Chunk(doc=doc_name, section=f"Section {j + 1}",
                              text=para.strip())
                    )
    for i in range(1, len(parts) - 2, 3):
        title, body = parts[i + 1].strip(), parts[i + 2].strip()
        text = f"{title}\n{body}".strip()
        if len(text) <= 1200:
            chunks.append(Chunk(doc=doc_name, section=title, text=text))
        else:
            for j, para in enumerate(re.split(r"\n\s*\n", body)):
                if para.strip():
                    chunks.append(
                        Chunk(doc=doc_name, section=f"{title} ({j + 1})",
                              text=f"{title}\n{para.strip()}")
                    )
    return chunks

def parse_document(filename: str, content: bytes) -> list[Chunk]:
    """Parse raw bytes (PDF or text) into document chunks."""
    text_content = ""
    if filename.lower().endswith(".pdf") and PdfReader:
        reader = PdfReader(io.BytesIO(content))
        for page in reader.pages:
            text_content += (page.extract_text() or "") + "\n\n"
    else:
        text_content = content.decode("utf-8", errors="ignore")

    return _split_markdown(filename, text_content)
