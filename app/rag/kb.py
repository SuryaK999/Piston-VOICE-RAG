"""Document parsing and chunking.

Text, PDF, Markdown, and Word (docx/doc) documents are parsed and split into
clean, bounded semantic chunks so each chunk is a self-contained topic for
high-granularity RAG retrieval and robust embedding without API limit overruns.
"""
from __future__ import annotations

import io
import logging
import re
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

log = logging.getLogger("rag.kb")

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


def _decode_text(content: bytes) -> str:
    """Robustly decode raw bytes handling BOMs, UTF-8, UTF-16, and Latin-1."""
    if not content:
        return ""
    if content.startswith(b"\xef\xbb\xbf"):
        return content.decode("utf-8-sig", errors="replace")
    if content.startswith(b"\xff\xfe") or content.startswith(b"\xfe\xff"):
        return content.decode("utf-16", errors="replace")

    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        pass

    # If null bytes are present, it might be UTF-16LE without BOM
    if b"\x00" in content[:200]:
        try:
            return content.decode("utf-16le", errors="ignore")
        except Exception:
            pass

    return content.decode("latin-1", errors="replace")


def _extract_docx(content: bytes) -> str:
    """Extract readable text from a .docx file without third-party dependencies."""
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            if "word/document.xml" not in z.namelist():
                return ""
            xml_data = z.read("word/document.xml")
            tree = ET.fromstring(xml_data)
            paragraphs = []
            for p in tree.iter():
                if p.tag.endswith("}p"):
                    texts = [n.text for n in p.iter() if n.tag.endswith("}t") and n.text]
                    if texts:
                        paragraphs.append("".join(texts))
            return "\n\n".join(paragraphs)
    except Exception as exc:
        log.warning("DOCX parser encountered an error: %s", exc)
        return ""


def _extract_doc(content: bytes) -> str:
    """Extract readable text from legacy binary Word (.doc) files."""
    try:
        text = _decode_text(content)
        # If it decoded as clean text (e.g. renamed text/rtf), use it
        if not any(ord(c) == 0 for c in text[:200]) and len(text.strip()) > 30:
            return text
    except Exception:
        pass

    # Extract ASCII and UTF-16 strings from binary stream
    ascii_runs = re.findall(b"[\x20-\x7E\r\n\t]{6,}", content)
    utf16_runs = re.findall(b"(?:[\x20-\x7E][\x00]){6,}", content)

    pieces = []
    for r in ascii_runs:
        try:
            s = r.decode("ascii", errors="ignore").strip()
            # Ignore OLE internal signatures
            if len(s) >= 6 and not any(s.startswith(x) for x in ["WordDocument", "CompObj", "SummaryInformation"]):
                pieces.append(s)
        except Exception:
            pass

    for r in utf16_runs:
        try:
            s = r.decode("utf-16le", errors="ignore").strip()
            if len(s) >= 6:
                pieces.append(s)
        except Exception:
            pass

    return "\n\n".join(pieces)


def _subdivide_text(text: str, max_chars: int = 1000, overlap: int = 100) -> list[str]:
    """Recursively subdivide long text into bounded chunks <= max_chars.
    
    Preserves semantic boundaries: paragraphs -> lines -> sentences -> character windows.
    Guarantees no chunk exceeds max_chars.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    # 1. Double newlines (paragraphs)
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(paras) > 1:
        result = []
        current: list[str] = []
        current_len = 0
        for p in paras:
            if len(p) > max_chars:
                if current:
                    result.append("\n\n".join(current))
                    current = []
                    current_len = 0
                result.extend(_subdivide_text(p, max_chars, overlap))
            elif current_len + len(p) + 2 <= max_chars:
                current.append(p)
                current_len += len(p) + 2
            else:
                if current:
                    result.append("\n\n".join(current))
                current = [p]
                current_len = len(p)
        if current:
            result.append("\n\n".join(current))
        return [r for r in result if r.strip()]

    # 2. Single newlines (lines / code blocks / lists)
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if len(lines) > 1:
        result = []
        current = []
        current_len = 0
        for line in lines:
            if len(line) > max_chars:
                if current:
                    result.append("\n".join(current))
                    current = []
                    current_len = 0
                result.extend(_subdivide_text(line, max_chars, overlap))
            elif current_len + len(line) + 1 <= max_chars:
                current.append(line)
                current_len += len(line) + 1
            else:
                if current:
                    result.append("\n".join(current))
                current = [line]
                current_len = len(line)
        if current:
            result.append("\n".join(current))
        return [r for r in result if r.strip()]

    # 3. Sentences (.!?)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if len(sentences) > 1:
        result = []
        current = []
        current_len = 0
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            if len(s) > max_chars:
                if current:
                    result.append(" ".join(current))
                    current = []
                    current_len = 0
                result.extend(_subdivide_text(s, max_chars, overlap))
            elif current_len + len(s) + 1 <= max_chars:
                current.append(s)
                current_len += len(s) + 1
            else:
                if current:
                    result.append(" ".join(current))
                current = [s]
                current_len = len(s)
        if current:
            result.append(" ".join(current))
        return [r for r in result if r.strip()]

    # 4. Fallback character window with overlap for unbreakable tokens
    step = max(100, max_chars - overlap)
    chunks = []
    for i in range(0, len(text), step):
        part = text[i : i + max_chars].strip()
        if part:
            chunks.append(part)
    return chunks


def _split_markdown(doc_name: str, content: str) -> list[Chunk]:
    """Split a document into structured, bounded chunks using headers and subdivision."""
    chunks: list[Chunk] = []
    content = content.strip()
    if not content:
        return chunks

    # Match Markdown headings from # down to ####
    parts = re.split(r"(?m)^(#{1,4})\s+(.+)$", content)

    # 1. Preamble before the first heading
    pre = parts[0].strip()
    if pre:
        sub_chunks = _subdivide_text(pre, max_chars=1000, overlap=100)
        for j, sub in enumerate(sub_chunks):
            sec_title = "Overview" if len(sub_chunks) == 1 else f"Overview ({j + 1})"
            chunks.append(Chunk(doc=doc_name, section=sec_title, text=sub))

    # 2. Sections under headings
    for i in range(1, len(parts) - 2, 3):
        title = parts[i + 1].strip()
        body = parts[i + 2].strip()
        if not body and not title:
            continue

        full_sec = f"{title}\n{body}".strip()
        sub_chunks = _subdivide_text(full_sec, max_chars=1000, overlap=100)
        for j, sub in enumerate(sub_chunks):
            sec_title = title if len(sub_chunks) == 1 else f"{title} ({j + 1})"
            chunks.append(Chunk(doc=doc_name, section=sec_title, text=sub))

    # Clean out very short / empty chunks
    return [c for c in chunks if len(c.text.strip()) >= 15]


def parse_document(filename: str, content: bytes) -> list[Chunk]:
    """Parse raw bytes (PDF, DOCX, DOC, Markdown, or text) into document chunks."""
    text_content = ""
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        if PdfReader:
            try:
                reader = PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    text_content += (page.extract_text() or "") + "\n\n"
            except Exception as exc:
                log.warning("PDF reading error for %s: %s", filename, exc)
    elif lower_name.endswith(".docx"):
        text_content = _extract_docx(content)
    elif lower_name.endswith(".doc"):
        text_content = _extract_doc(content)
    else:
        text_content = _decode_text(content)

    # Fallback to plain decoding if format extractor returned empty
    if not text_content.strip():
        text_content = _decode_text(content)

    return _split_markdown(filename, text_content)
