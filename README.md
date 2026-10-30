<div align="center">

<br/>

<img src="https://raw.githubusercontent.com/SuryaK999/Piston-VOICE-RAG/main/static/assets/piston-brand/piston-mark-192.png" width="88" height="88" alt="Piston Mark" />

# Piston — Voice RAG Agent

**Talk to your documents. Get real answers. Instantly.**

*A full-stack, real-time voice AI assistant that lets you speak naturally to your uploaded documents — powered by Google Gemini Live and a production-grade LangGraph RAG pipeline.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-Live%20API-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2%2B-FF6B35?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![FAISS](https://img.shields.io/badge/FAISS-In--Memory-00A896?style=for-the-badge)](https://github.com/facebookresearch/faiss)
[![License](https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge)](LICENSE)

<br/>

---

</div>

## 📋 Table of Contents

- [✨ What is Piston?](#-what-is-piston)
- [🎯 Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [🔬 How It Works](#-how-it-works)
  - [RAG Pipeline Deep-Dive](#rag-pipeline-deep-dive)
  - [Document Parsing & Chunking](#document-parsing--chunking)
  - [Embedding & Vector Store](#embedding--vector-store)
  - [WebSocket Audio Bridge](#websocket-audio-bridge)
  - [Frontend & UI](#frontend--ui)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the App](#running-the-app)
- [⚙️ Configuration Reference](#️-configuration-reference)
- [📡 API Reference](#-api-reference)
- [🧪 Testing](#-testing)
- [🤖 AI Persona — "Piston"](#-ai-persona--piston)
- [🎨 UI & Design](#-ui--design)
- [🎨 Brand Assets](#-brand-assets)
- [🔌 Technology Stack](#-technology-stack)
- [🛣️ Roadmap](#️-roadmap)
- [👨‍💻 Developer](#-developer)

---

## ✨ What is Piston?

**Piston** is a real-time, voice-first Retrieval-Augmented Generation (RAG) agent. You speak naturally — Piston listens, searches your uploaded documents, and replies in voice within seconds.

It is designed for scenarios where speed and naturalness matter:

| Use Case | Example |
|---|---|
| 🎤 **Interview Prep** | *"What are my key skills on this resume?"* |
| 📄 **Document Q&A** | *"What's the deadline mentioned in this contract?"* |
| 🔍 **Resume Screening** | *"Rate these candidates against the job description."* |
| 📊 **Research** | *"Summarize the methodology section of this paper."* |
| 📝 **Comparison** | *"Compare candidate A and B across these five criteria."* |
| 📋 **Policy Lookup** | *"How many sick days do I get per year?"* |

> **Piston never guesses.** It only answers from what you've uploaded. If the information is not in your documents, it says so honestly — every single time.

---

## 🎯 Key Features

| Feature | Description |
|---|---|
| 🎙️ **Real-Time Voice I/O** | Full-duplex audio via WebSocket. Speak and get spoken answers with no push-to-talk required. |
| 🧠 **Grounded-Only Answers** | Hard-constrained to answer *only* from uploaded documents — hallucination is architecturally prevented. |
| 📎 **Multi-Document Support** | Upload multiple PDFs, TXT, or Markdown files. All are indexed into the same shared vector store. |
| 🔁 **LangGraph RAG Pipeline** | 4-node graph: **Rewrite → Retrieve → Grade → Synthesize** with per-node millisecond latency tracing. |
| 🛡️ **Relevance Gating** | Cosine score floor (0.35) + LLM YES/NO grader prevents irrelevant chunks from reaching the answer. |
| 🗣️ **Query Rewriting** | Spoken queries (often messy) are rewritten into clean keyword-rich retrieval queries before FAISS search. |
| 📱 **Responsive UI** | Dark/light mode, collapsible side panels, mobile-drawer layout with live transcript stream. |
| ⚡ **Interrupt & Mute** | Interrupt Piston mid-sentence by speaking, or mute your mic — without dropping the WebSocket connection. |
| 💾 **Persistent Transcript** | Full conversation history saved to `localStorage` and restored on page refresh. |
| ⏱️ **Inactivity Timeout** | 15-second silence timer ends the session gracefully with a tone cue. |
| 🧪 **Offline Test Suite** | All RAG plumbing verified without an API key using deterministic hash embeddings. |
| 🔊 **Configurable Voice** | Choose any Gemini TTS voice (`Kore`, `Puck`, `Charon`, `Aoede`, and more) via `.env`. |
| 📡 **Health Endpoint** | `/health` for uptime monitoring and readiness checks. |
| 🎨 **Complete Brand System** | SVG mark, wordmark, PNG icons (192px, 512px), and favicon in `static/assets/piston-brand/`. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER  (UI)                            │
│                                                                  │
│  ┌──────────────────┐   ┌────────────────────────────────────┐   │
│  │  Left Panel       │   │   Center Stage                     │   │
│  │  ─────────────── │   │  ┌──────────────────────────────┐  │   │
│  │  • Upload docs    │   │  │  Animated Orb                │  │   │
│  │  • Document list  │   │  │  idle / listening / speaking │  │   │
│  │  • Search filter  │   │  │  searching / error           │  │   │
│  │  • Context select │   │  └──────────────────────────────┘  │   │
│  │  • Voice guide    │   │  [Mute]  [Interrupt]  [End]        │   │
│  └──────────────────┘   └────────────────────────────────────┘   │
│                                                                  │
│  Right Panel: Live Transcript + RAG trace chips                  │
│                                                                  │
│  mic PCM 16kHz ──binary──► WebSocket /ws ◄──binary── PCM 24kHz  │
│  JSON ctrl msgs ──text───►              ◄──text──── JSON events  │
└──────────────────────────────────────────────────────────────────┘
                                  │
                       ┌──────────┴──────────┐
                       │     FastAPI App      │
                       │  GET  /  → index     │
                       │  POST /upload → RAG  │
                       │  WS   /ws → Live     │
                       │  GET  /health → JSON │
                       └──────────┬──────────┘
                                  │
               ┌──────────────────┴──────────────────┐
               │                                     │
      ┌────────▼────────────┐            ┌───────────▼─────────────┐
      │   Gemini Live API   │            │   LangGraph RAG Pipeline │
      │   gemini-3.8-live   │            │                         │
      │                     │            │  ┌───────┐  ┌────────┐  │
      │  ← PCM audio out    │◄── answer ─│  │Rewrite│→ │Retrieve│  │
      │  → PCM audio in     │            │  └───────┘  └────────┘  │
      │  → transcription    │            │       ↓ FAISS TOP_K=4   │
      │  ↔ tool calls       │            │  ┌───────┐              │
      └─────────────────────┘            │  │ Grade │ (floor 0.35) │
                                         │  └───┬───┘              │
                                         │      ├─relevant→Synthesize
                                         │      └─none──→ no_answer │
                                         │                         │
                                         │  FAISS VectorStore      │
                                         │  Gemini Embedding-001   │
                                         │  (768-dim, L2-normed)   │
                                         └─────────────────────────┘
```

---

## 🔬 How It Works

### RAG Pipeline Deep-Dive

The heart of Piston is a **4-node LangGraph state graph** defined in `app/rag/graph.py`. It is invoked every time Gemini calls the `search_knowledge_base` tool:

```
User speaks → Gemini Live → tool call: search_knowledge_base(question)
                                               │
                               ┌───────────────▼────────────────┐
                               │           REWRITE               │
                               │  gemini-flash-lite rewrites the │
                               │  spoken query into a clean      │
                               │  keyword-rich search query.     │
                               │  "uh what does it say about     │
                               │   the deadline" → "deadline     │
                               │   date project contract"        │
                               └───────────────┬────────────────┘
                                               │ rewritten query
                               ┌───────────────▼────────────────┐
                               │           RETRIEVE              │
                               │  FAISS inner-product search     │
                               │  on L2-normalised float32 vecs  │
                               │  Returns TOP_K = 4 chunks with  │
                               │  their cosine similarity scores │
                               └───────────────┬────────────────┘
                                               │ chunks + scores
                               ┌───────────────▼────────────────┐
                               │            GRADE                │
                               │  Step 1: cosine floor = 0.35   │
                               │  If best score < 0.35 → "none" │
                               │  Step 2 (if above floor): LLM  │
                               │  prompt asks YES/NO for         │
                               │  relevance to the question.     │
                               └──────────┬──────────┬──────────┘
                                          │          │
                                      relevant      none
                                          │          │
                         ┌────────────────▼──┐  ┌───▼────────────────┐
                         │    SYNTHESIZE      │  │    NO_ANSWER        │
                         │  LLM compresses   │  │  Returns a fixed    │
                         │  top 4 chunks     │  │  graceful decline:  │
                         │  into 2-3 plain   │  │  "I couldn't find   │
                         │  spoken sentences │  │   that in your      │
                         │  (no markdown,    │  │   uploaded docs."   │
                         │  no bullets)      │  └─────────────────────┘
                         └───────────────────┘
```

Every node records its execution time in milliseconds. The `latency_ms` dict (e.g. `{"rewrite": 312, "retrieve": 45, "grade": 280, "synthesize": 410}`) is forwarded to the UI and displayed in the transcript trace chips.

**Why this 4-node design instead of a simple "search" function?**

- **Rewrite** — spoken queries are noisy and colloquial. Rewriting them into keyword-rich queries dramatically improves FAISS retrieval quality.
- **Grade** — the #1 failure mode of voice RAG is answering from loosely-related or irrelevant chunks. The explicit relevance gate hard-blocks hallucinated answers.
- **Synthesize** — voice answers must be short and natural (spoken aloud). The synthesis step enforces 2–3 sentences in plain spoken English.
- **No_answer** — honest, graceful decline is better UX than a fabricated answer.

---

### Document Parsing & Chunking

Defined in `app/rag/kb.py`. Handles two formats:

**PDF** (via `pypdf`):
- Full text extracted page by page, concatenated with double-newlines.
- Result passed into the same Markdown/text splitter.

**Text / Markdown / plain `.txt`**:
- Split on `# ` or `## ` section headers using regex.
- Content before the first header becomes an `"Overview"` chunk.
- Each `## Section` becomes one chunk named after its title.
- Chunks over **1,200 characters** are further split on paragraph breaks (`\n\n`) to maintain retrieval granularity.
- Plain-text files with no headers are split purely on paragraph breaks.

Each chunk is a `Chunk` dataclass:
```python
@dataclass
class Chunk:
    doc: str        # source filename, e.g. "report.pdf"
    section: str    # section title, e.g. "Overview"
    text: str       # header + body text (≤ 1200 chars)
    meta: dict      # extensible metadata dict

    @property
    def source_label(self) -> str:
        return f"{self.doc} › {self.section}"
```

---

### Embedding & Vector Store

Defined in `app/rag/embeddings.py` and `app/rag/store.py`.

**Embedder** — `make_gemini_embedder()`:
- Uses `gemini-embedding-001` with output dimensionality fixed at **768**.
- Embeddings are L2-normalised to unit vectors so inner-product == cosine similarity.
- Batches texts in groups of **50** with a **1-second sleep between batches** to respect API rate limits.
- `task_type="RETRIEVAL_DOCUMENT"` for indexing, `"RETRIEVAL_QUERY"` for search-time queries.

**Vector Store** — `VectorStore` (wraps `faiss.IndexFlatIP`):
- `IndexFlatIP` = exact inner-product search on unit vectors (equivalent to cosine).
- **Dynamic**: `add_chunks()` lets you upload documents at any time without rebuilding the index.
- `search(query, embed_fn, k=4)` returns `list[tuple[Chunk, float]]` — chunk + cosine score.
- Zero persistence — the index lives in RAM for the server's lifetime; re-upload documents after a restart.

**Offline test embedder** — `make_hash_embedder()`:
- Deterministic, API-key-free embedder for unit tests.
- Seeds `numpy.random` from `hash(task_type + text)` → same text always maps to the same unit vector.

---

### WebSocket Audio Bridge

Defined in `app/live_session.py`. Each browser connection spawns **one Gemini Live session** and two concurrent asyncio tasks:

```
Browser                        FastAPI /ws                 Gemini Live
───────                        ───────────                 ───────────
mic PCM Int16 16kHz ─binary──► session.send_realtime_input(audio)
                    ◄─binary──────────────────────────── PCM Int16 24kHz
{"type":"ping"}     ─text───►  {"type":"pong"}
                    ◄─text──── {"type":"status","status":"ready"}
                    ◄─text──── {"type":"transcript","role":"user","text":"..."}
                    ◄─text──── {"type":"transcript","role":"agent","text":"..."}
                    ◄─text──── {"type":"tool","status":"running",...}
                    ◄─text──── {"type":"tool","status":"done","trace":[...],...}
                    ◄─text──── {"type":"turn_complete"}
                    ◄─text──── {"type":"interrupted"}
                    ◄─text──── {"type":"end_session"}
                    ◄─text──── {"type":"error","message":"..."}
```

**`browser_to_gemini()` task:**
- Reads binary frames → forwards raw PCM to Gemini as `audio/pcm;rate=16000` blobs.
- Reads text frames → handles `ping` / `pong` keepalive.

**`gemini_to_browser()` task:**
- On `tool_call` from Gemini → dispatches to `dispatch_tool()` in `app/tools.py`:
  1. Sends `{type:"tool", status:"running"}` to UI.
  2. Runs `rag_service.ask(question)` via `asyncio.to_thread` (non-blocking).
  3. Sends `FunctionResponse` back to Gemini (answer + sources).
  4. Sends `{type:"tool", status:"done", trace:[...], latency_ms:{...}, sources:[...]}` to UI.
  5. If tool name is `end_session` → sets `stop` event, sends `{type:"end_session"}`, closes.
- On `server_content.interrupted` → sends `{type:"interrupted"}` to flush browser audio buffer.
- On `model_turn` audio parts → streams raw PCM bytes directly to browser as binary frames.
- On `input_transcription` / `output_transcription` → sends transcript JSON events.
- On `turn_complete` → sends `{type:"turn_complete"}`.

**Error handling:** any exception in either task is caught, surfaced as `{type:"error"}` to the browser, and the WebSocket is closed cleanly.

---

### Frontend & UI

`static/app.js` (~712 lines), `static/index.html` (~175 lines), `static/piston.css` (~600 lines) — all **vanilla JS + CSS, zero build step, zero framework**.

**Audio pipeline:**
- `pcm-worklet.js` runs in an `AudioWorkletProcessor` (off the main thread).
- Captures microphone as 16kHz mono PCM Int16 and `postMessage`s chunks to the main thread.
- Main thread forwards chunks as binary WebSocket frames.
- Incoming binary frames (24kHz PCM from Gemini) are decoded, scheduled into `AudioContext` buffer sources with jitter-buffering (`nextPlayTime` cursor).

**Interrupt detection:**
- Each incoming mic chunk's RMS amplitude is computed on the main thread.
- If `rms > 0.03` while `appState === 'speaking'` → immediately flush all queued audio sources, set `isInterrupting = true`, transition to `listening`.

**Animation loop (`requestAnimationFrame`):**
- `state-listening`: orb wave rings scale proportional to mic `rms` → visual voice activity indicator.
- `state-speaking`: rings scale proportional to AI audio `rms` (decayed at 0.9× per frame).
- `state-searching`: CSS keyframe animation (fast pulse) — no RMS needed.
- `state-idle` / `state-error`: rings collapse to scale 1, opacity 0.

**Context selector:**
- Dropdown button shows active document name (or "Everything" for all docs).
- Smart positioning: if less than 320px below the button, the dropdown pops upward.

---

## 📁 Project Structure

```
voice-rag-agent/
│
├── app/                            # Python backend package
│   ├── __init__.py
│   ├── main.py                     # FastAPI app, lifespan, routes (/upload, /ws, /health)
│   ├── config.py                   # Env-var loading, model names, SYSTEM_INSTRUCTION (15 rules)
│   ├── live_session.py             # WebSocket ↔ Gemini Live asyncio bridge (2 concurrent tasks)
│   ├── tools.py                    # Tool declarations (search_knowledge_base, end_session)
│   └── rag/
│       ├── __init__.py
│       ├── embeddings.py           # Gemini embedder (768-dim, batched 50, rate-limited)
│       │                           # + make_hash_embedder() for offline tests
│       ├── graph.py                # LangGraph RAG graph: Rewrite→Retrieve→Grade→Synthesize
│       │                           # TOP_K=4, RELEVANCE_FLOOR=0.35, per-node latency tracing
│       ├── kb.py                   # parse_document(): PDF + Markdown/text → Chunk list
│       │                           # Chunks ≤ 1200 chars, split on ## headers or paragraphs
│       └── store.py                # VectorStore: faiss.IndexFlatIP, add_chunks(), search()
│
├── static/                         # Frontend (served at /static by FastAPI StaticFiles)
│   ├── index.html                  # 3-panel app shell (top-bar, left, center-stage, right)
│   ├── app.js                      # Full frontend (~712 lines): WS, AudioContext, DOM, state
│   ├── piston.css                  # Design system: CSS vars, orb animations, dark/light theme
│   ├── pcm-worklet.js              # AudioWorkletProcessor — off-thread 16kHz PCM capture
│   └── assets/
│       └── piston-brand/
│           ├── favicon.svg         # 64×64 SVG icon (5 bars on cream bg, orange #FF5A1F)
│           ├── favicon-64.png      # 64×64 PNG favicon
│           ├── favicon.ico         # Multi-resolution .ico
│           ├── piston-mark.svg     # 72×72 logomark — 5 orange bars, no background
│           ├── piston-mark-192.png # 192×192 PNG mark (PWA icon / README logo)
│           ├── piston-mark-512.png # 512×512 PNG mark (high-res / app store)
│           ├── piston-wordmark.svg # Full wordmark: 5 bars + "Piston" serif text
│           └── piston-wordmark-2x.png  # @2x PNG wordmark for HiDPI
│
├── scripts/
│   ├── test_offline.py             # 15-check offline test — no API key needed
│   └── test_rag_live.py            # Live RAG integration test — needs GOOGLE_API_KEY in .env
│
├── .env.example                    # Template with all supported env vars and comments
├── .env                            # Your local config — gitignored
├── requirements.txt                # 10 Python dependencies with version pins
├── run.py                          # Entry point: uvicorn app.main:app on port 8000
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Details |
|---|---|
| **Python** | 3.10 or newer |
| **Google API Key** | Free key from [Google AI Studio](https://aistudio.google.com/apikey) — Gemini Live requires it |
| **Browser** | Chrome 110+, Firefox 110+, or Edge 110+ (Web Audio API + AudioWorklet required) |
| **Microphone** | Any microphone; browser will request permission on first session |

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/SuryaK999/Piston-VOICE-RAG.git
cd Piston-VOICE-RAG
```

**2. Create and activate a virtual environment**

```bash
# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1

# macOS / Linux
python -m venv .venv
source .venv/bin/activate
```

**3. Install all dependencies**

```bash
pip install -r requirements.txt
```

> **Note:** `faiss-cpu` is used by default (no GPU required). Substitute `faiss-gpu` if you have a CUDA GPU and want faster search at large scale.

### Configuration

**4. Copy the environment template**

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

**5. Set your Google API key**

Open `.env` and fill in your key:

```env
# Required — get yours free at https://aistudio.google.com/apikey
GOOGLE_API_KEY=your_actual_key_here

# Model overrides — defaults shown below (from .env.example)
LIVE_MODEL=gemini-3.8-live
TEXT_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001

# TTS voice for Piston's spoken responses
VOICE_NAME=Kore
```

### Running the App

**6. Start the server**

```bash
python run.py
```

Or with hot-reload during development:

```bash
uvicorn app.main:app --reload --port 8000
```

**7. Open the app**

Navigate to **[http://localhost:8000](http://localhost:8000)**

**8. Upload → Speak → Get answers**

1. Click **Upload** (top bar) — select any `.pdf`, `.txt`, or `.md` file.
2. Wait for the **"Indexed"** green badge to appear in the document list.
3. Click the **animated orb** in the center — grant microphone permission when prompted.
4. **Speak your question.** Piston searches your documents and replies in voice.
5. To interrupt Piston mid-reply, just **start speaking** — the audio stops instantly.
6. Say **"goodbye"** or click **End session** to close the voice connection.

---

## ⚙️ Configuration Reference

All settings are read from `.env` at startup via `python-dotenv`.

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_API_KEY` | *(required)* | Your Google AI Studio API key. Without this, the server starts but all sessions fail. |
| `LIVE_MODEL` | `gemini-3.8-live` | Gemini Live model used for real-time voice I/O and tool calling. |
| `TEXT_MODEL` | `gemini-2.5-flash` | Gemini model used inside the RAG pipeline for query rewriting, relevance grading, and answer synthesis. |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model. Output dimensionality is fixed at **768** in code. |
| `VOICE_NAME` | `Kore` | Gemini TTS voice for Piston's spoken replies. |

**Available TTS voices:** `Kore` · `Puck` · `Charon` · `Aoede` · `Fenrir` · `Leda` · `Orus` · `Zephyr`

> The server picks up `TEXT_MODEL` from `.env` at startup. The fallback in `config.py` is `gemini-flash-lite-latest` — but `.env.example` recommends `gemini-2.5-flash` for best RAG quality.

---

## 📡 API Reference

### `GET /`

Serves `static/index.html` — the full Piston UI.

---

### `GET /health`

Returns server health and readiness.

```json
{
  "ok": true,
  "kb_ready": true,
  "live_model": "gemini-3.8-live"
}
```

| Field | Value | Meaning |
|---|---|---|
| `ok` | `true` | Server is running |
| `kb_ready` | `true` | RAG service initialised; `GOOGLE_API_KEY` is present and valid |
| `kb_ready` | `false` | `GOOGLE_API_KEY` missing — sessions will fail with an error message |
| `live_model` | string | Which Gemini Live model is configured |

---

### `POST /upload`

Uploads a document and indexes it into the in-memory FAISS vector store.

**Request:** `multipart/form-data`, field name `file`.

**Accepted formats:** `.pdf` · `.txt` · `.md` (and any UTF-8 plain text)

**Response — success `200`:**
```json
{ "message": "Processed 14 chunks from resume.pdf." }
```

**Response — errors:**

| HTTP | Body | Cause |
|---|---|---|
| `400` | `{"error": "Empty file."}` | Uploaded file has zero bytes |
| `400` | `{"error": "No readable text found in the file."}` | PDF has no extractable text / encoding failed |
| `400` | `{"error": "Could not parse file: ..."}` | Parsing threw an unexpected exception |
| `500` | `{"error": "Failed to embed document: ..."}` | Gemini embedding API error |
| `500` | `{"error": "RAG Service not initialized. Is GOOGLE_API_KEY set?"}` | Missing API key |

---

### `WebSocket /ws`

Real-time full-duplex audio + event bridge.

**Binary frames — browser → server:** Raw PCM, `Int16`, mono, **16,000 Hz**

**Binary frames — server → browser:** Raw PCM, `Int16`, mono, **24,000 Hz**

**Text frames — server → browser:** JSON events

| `type` | Key fields | When sent |
|---|---|---|
| `status` | `status: "ready"` | Gemini Live session opened successfully |
| `transcript` | `role: "user"\|"agent"`, `text: string` | Streaming transcription fragment |
| `turn_complete` | — | The agent's turn is fully finished |
| `tool` | `name`, `detail`, `status: "running"\|"done"`, `trace: string[]`, `latency_ms: {}`, `sources: string[]` | RAG tool call started / finished |
| `interrupted` | — | User spoke while agent was speaking; audio buffer should be flushed |
| `end_session` | — | `end_session` tool was called; WebSocket will close |
| `error` | `message: string` | Fatal session error; WebSocket will close |
| `pong` | — | Response to a `{"type":"ping"}` keepalive from the browser |

---

## 🧪 Testing

### Offline Tests — no API key needed

`scripts/test_offline.py` validates the entire RAG stack using a **deterministic hash embedder** instead of Gemini. It tests 15 conditions across 7 test groups.

```bash
python scripts/test_offline.py
```

**Test coverage:**

| Group | What is tested |
|---|---|
| Document parsing | Markdown splits into ≥ 3 chunks; every chunk has a `source_label`; sections named correctly |
| Plain text fallback | A file with no `##` headers still produces ≥ 1 chunk |
| Vector store build | `IndexFlatIP` size equals chunk count after `VectorStore.build()` |
| Search | Exact-text query retrieves the correct chunk (deterministic hash embedding) |
| Dynamic `add_chunks` | Index and chunk list both grow by exactly 1 after adding a new chunk |
| Empty store edge cases | `ntotal == 0`; `add_chunks([])` is a no-op |
| LangGraph wiring | Graph produces `answer`, `trace`, `latency_ms`, `sources` on the relevant path; graceful `no_answer` on the irrelevant path |
| Tool declarations | Two tools declared; first tool is `search_knowledge_base` |

**Expected output:**
```
== Document parsing ==
  [OK] chunks parsed
  [OK] every chunk has a source label
  [OK] sections split correctly
== Plain text fallback ==
  [OK] plain text parsed
== Vector store ==
  [OK] index size matches chunks
  [OK] chunks list matches
  [OK] search returns results
== Dynamic add_chunks ==
  [OK] index grew by 1
  [OK] chunk list grew
== Empty store ==
  [OK] empty store has 0 vectors
  [OK] empty store has 0 chunks
  [OK] add_chunks with [] is no-op
== LangGraph wiring (stub LLM) ==
  [OK] graph returns an answer string
  [OK] trace is a list
  [OK] latency_ms is a dict
  [OK] sources is a list
  [OK] irrelevant -> graceful no_answer
  [OK] no_answer has empty sources
== Tools ==
  [OK] two tools declared
  [OK] tool is search_knowledge_base

15 passed, 0 failed
```

---

### Live Integration Tests — API key required

`scripts/test_rag_live.py` runs the **real Gemini API** (embeddings + text generation) against a built-in sample document (a company leave policy). No running server needed — it calls `build_rag_service()` directly.

```bash
# Make sure GOOGLE_API_KEY is set in .env first
python scripts/test_rag_live.py
```

**What it does:**
1. Builds a real `RAGService` with Gemini embedder + text LLM.
2. Parses and indexes a 4-section sample Markdown document (`leave_policy.md`).
3. Asks 5 questions (4 answerable, 1 deliberately unanswerable → tests graceful decline).
4. Prints `answer`, `sources`, total `latency_ms` breakdown, and the full `trace` for each.

**Sample output:**
```
Q: How many days of annual leave do I get?
A: Full-time employees are entitled to 24 days of paid annual leave per year.
   sources: ['leave_policy.md › Annual Leave']
   latency: 1243 ms  {'rewrite': 312, 'retrieve': 45, 'grade': 476, 'synthesize': 410}

Q: What's the dress code?
A: I couldn't find that in the uploaded documents. Try uploading a relevant file first...
   sources: []
```

---

## 🤖 AI Persona — "Piston"

Piston's voice personality is defined by a 15-rule `SYSTEM_INSTRUCTION` in `app/config.py`. These rules are injected into every Gemini Live session at connection time.

| # | Rule | Behaviour |
|---|---|---|
| 1 | **Grounded answers only** | MUST call `search_knowledge_base` before answering ANY factual question. Never answers from Gemini's training knowledge. |
| 2 | **Short responses** | Max 2–3 sentences. This is voice — no markdown, no bullet points, no lists. |
| 3 | **No repeated greeting** | Greets the user once at the start. If the user has already spoken, skips the greeting. |
| 4 | **Honest decline** | If search returns no results: *"I couldn't find that in your uploaded documents."* |
| 5 | **Direct** | Never says *"What would you like to know?"* — searches and answers immediately. |
| 6 | **Identity** | If asked its name: *"My name is Piston"* — no tool call needed. |
| 7 | **Creator** | If asked about the developer: *"My developer is Surya Prakash Kudupudi"* — no tool call needed. |
| 8 | **Wellbeing** | If asked how it is: *"I am fine, thank you"* — no tool call needed. |
| 9 | **Document summary** | Can summarise a specific or all uploaded documents by searching first. |
| 10 | **Context switching** | Can switch focus to a different document when asked. |
| 11 | **Repeat on request** | Repeats its last statement if asked. |
| 12 | **Resume rating** | Rates resumes/docs against user-specified requirements after searching. |
| 13 | **Multi-doc comparison** | Compares two or more resumes/docs after searching each. |
| 14 | **Tone adaptation** | Adjusts tone (professional, casual, etc.) when explicitly asked. |
| 15 | **Ethical** | Maintains ethical standards regardless of framing. |

**Registered Tools:**

| Tool | Required args | Description |
|---|---|---|
| `search_knowledge_base` | `question: string` | Runs the full LangGraph pipeline. Returns `{answer, sources}` to Gemini; sends `{trace, latency_ms, sources}` to the UI. |
| `end_session` | *(none)* | Gracefully ends the voice session. Triggered by "goodbye", "stop", "end call", or similar. |

---

## 🎨 UI & Design

Piston's interface is a **3-panel dark-first layout** built with zero dependencies — plain HTML5, CSS3 custom properties, and vanilla JS ES2020+.

```
┌──────────────┬──────────────────────────┬───────────────────┐
│  Left Panel  │      Center Stage        │   Right Panel     │
│              │                          │                   │
│  Your Docs   │   ╔═════════════════╗    │  Live Transcript  │
│  ─────────── │   ║                 ║    │  ──────────────── │
│  📄 doc1.pdf │   ║   ◉ Piston Orb  ║    │  You: "..."       │
│  📝 notes.md │   ║  (animated orb) ║    │  Piston: "..."    │
│  📄 resume   │   ║                 ║    │  ┌─────────────┐  │
│              │   ╚═════════════════╝    │  │ Tool trace  │  │
│  [🔍 Search] │                          │  │ 2 passages  │  │
│              │  ╔═══════════════════╗   │  └─────────────┘  │
│  [? Guide]   │  ║ doc.pdf  ▼  3 docs║   │                   │
│              │  ╚═══════════════════╝   │                   │
│              │                          │                   │
│              │  [Mute] [■ Stop] [End]   │                   │
└──────────────┴──────────────────────────┴───────────────────┘
```

**Orb visual states:**

| CSS class | Visual | Trigger |
|---|---|---|
| `state-idle` | Silver-gray, soft glow | No active session |
| `state-listening` | Orange, rings scale with mic RMS | Session active, user can speak |
| `state-speaking` | Orange-to-white, rings pulse with AI audio amplitude | Piston is speaking |
| `state-searching` | Orange fast-pulse keyframe | RAG pipeline is running |
| `state-error` | Red, static | WebSocket / mic / API error |

**All UI features:**

| Feature | Detail |
|---|---|
| 🌙 **Dark / Light theme** | Toggle button in top bar; preference persisted in `localStorage` under key `piston_theme`; respects `prefers-color-scheme` on first load |
| 📱 **Mobile responsive** | Left panel becomes a slide-in drawer; right (transcript) panel toggled via icon; center stage always visible |
| 🔍 **Document search filter** | Real-time substring filter on both the left panel list and the context dropdown simultaneously |
| 📋 **Context dropdown** | Smart-positioned (pops up if < 320px of viewport below) — shows all uploaded docs, click to set focus |
| 💬 **Transcript persistence** | Saved as JSON array in `localStorage` key `piston_transcript`; restored on every page load |
| 🗑️ **Clear transcript** | Double-click the "Live transcript" header to wipe history from both UI and `localStorage` |
| 📶 **Mini-waveform** | 4 animated bars in the transcript header pulsing with mic activity |
| ⏱️ **Inactivity timeout** | 15-second silence timer; fires a descending tone (`440→110 Hz`, 0.5 s) then stops the session |
| 🔇 **Mute toggle** | Silences mic transmission; orb icon and label swap; audio stream stays open |
| ⏹️ **Interrupt button** | Flushes queued audio and signals `turn_complete` to Gemini |

---

## 🎨 Brand Assets

All brand files live in `static/assets/piston-brand/`. The Piston mark is **5 vertical bars in orange (`#FF5A1F`)** at varying heights — an equalizer/audio waveform motif.

| File | Size | Use |
|---|---|---|
| `favicon.svg` | 64×64 | Browser tab favicon (SVG, cream `#FFFDF9` background) |
| `favicon-64.png` | 64×64 | PNG favicon fallback |
| `favicon.ico` | multi-res | Legacy `.ico` for older browsers |
| `piston-mark.svg` | 72×72 | Logomark only — transparent background, orange bars |
| `piston-mark-192.png` | 192×192 | PWA icon / README header / social preview |
| `piston-mark-512.png` | 512×512 | High-res mark for app stores / marketing |
| `piston-wordmark.svg` | 292×72 | Full wordmark — 5 bars + "Piston" in `Georgia` serif |
| `piston-wordmark-2x.png` | @2x PNG | HiDPI wordmark for retina displays |

---

## 🔌 Technology Stack

### Backend

| Library | Pin | Role |
|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com/) | `≥ 0.115` | ASGI framework — REST routes + WebSocket endpoint |
| [Uvicorn](https://www.uvicorn.org/) | `≥ 0.30` (standard) | ASGI server with WebSocket and HTTP/2 support |
| [google-genai](https://pypi.org/project/google-genai/) | `≥ 1.30` | Official Google Gemini SDK — Live API, embeddings, text generation |
| [LangGraph](https://langchain-ai.github.io/langgraph/) | `≥ 0.2.60` | Stateful RAG graph — `StateGraph`, conditional edges, `Annotated` reducers |
| [FAISS (cpu)](https://github.com/facebookresearch/faiss) | `≥ 1.8` | `IndexFlatIP` — exact inner-product search on unit vectors (= cosine) |
| [NumPy](https://numpy.org/) | `≥ 1.26` | Embedding math, L2 normalisation, PCM array ops |
| [pypdf](https://pypdf.readthedocs.io/) | `≥ 4.0` | PDF text extraction, page-by-page |
| [python-dotenv](https://pypi.org/project/python-dotenv/) | `≥ 1.0` | `.env` file loading at import time |
| [python-multipart](https://pypi.org/project/python-multipart/) | `≥ 0.0.6` | `multipart/form-data` file upload parsing for FastAPI |
| [websockets](https://websockets.readthedocs.io/) | `≥ 12.0` | Underlying WebSocket transport (used by Uvicorn standard) |

### Frontend

| Technology | Role |
|---|---|
| Vanilla **HTML5** | Semantic app shell — `<header>`, `<main>`, `<aside>`, `<section>` |
| Vanilla **CSS3** | CSS custom properties design system, keyframe animations, responsive grid, dark/light theme |
| Vanilla **JavaScript ES2020+** | WebSocket client, `AudioContext`, `AudioWorkletNode`, DOM management, state machine |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | PCM capture from mic + PCM playback with jitter buffer scheduling |
| [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) | Off-main-thread 16kHz Int16 PCM capture (`pcm-worklet.js`) |
| [Google Fonts](https://fonts.google.com/) | **Inter** (weights 400/500/600) for UI text · **Playfair Display** (600) for brand heading |

### AI Models (Google Gemini)

| Model | Configured via | Role |
|---|---|---|
| `gemini-3.8-live` | `LIVE_MODEL` | Bidirectional voice streaming — audio in, audio out, live transcription, tool calling |
| `gemini-2.5-flash` | `TEXT_MODEL` | RAG reasoning — query rewrite, YES/NO relevance grade, 2–3 sentence synthesis |
| `gemini-embedding-001` | `EMBEDDING_MODEL` | 768-dim text embeddings, L2-normalised, task-type aware |

---

## 🛣️ Roadmap

- [ ] **Persistent vector store** — serialise/load FAISS index to disk so documents survive server restarts
- [ ] **Per-session isolation** — each browser session gets its own knowledge base (multi-user support)
- [ ] **DOCX support** — parse Microsoft Word documents via `python-docx`
- [ ] **Document deletion** — remove individual files from the knowledge base at runtime
- [ ] **Hybrid retrieval** — BM25 keyword search + semantic re-ranking for higher recall
- [ ] **Streaming synthesis** — stream the synthesised text to the transcript before audio finishes playing
- [ ] **Session recording** — export the full session as a `.txt` transcript or `.wav` audio file
- [ ] **Docker image** — `docker run` one-liner for zero-setup deployment

---

## 👨‍💻 Developer

<div align="center">

<br/>

<img src="https://raw.githubusercontent.com/SuryaK999/Piston-VOICE-RAG/main/static/assets/piston-brand/piston-wordmark-2x.png" height="36" alt="Piston wordmark" />

<br/><br/>

Built with ❤️ by **Surya Prakash Kudupudi**

[![GitHub](https://img.shields.io/badge/GitHub-SuryaK999-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/SuryaK999)

<br/>

*"Your documents deserve to speak."*

<br/>

---

**[⬆ Back to Top](#piston--voice-rag-agent)**

<br/>

*Piston is an independent open-source project and is not affiliated with or endorsed by Google LLC.*

</div>
