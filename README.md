<div align="center">

<br/>

<!-- Logo / Brand -->
<img src="https://raw.githubusercontent.com/SuryaK999/Piston-VOICE-RAG/main/static/assets/piston-brand/favicon.svg" width="60" height="60" alt="Piston Logo" />

# 🎙️ Piston — Voice RAG Agent

**Talk to your documents. Get real answers. Instantly.**

*A full-stack voice AI assistant that lets you speak naturally to your uploaded documents using Google Gemini Live and a production-grade LangGraph RAG pipeline.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Live%20API-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
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
- [🔌 Technology Stack](#-technology-stack)
- [🛣️ Roadmap](#️-roadmap)
- [👨‍💻 Developer](#-developer)

---

## ✨ What is Piston?

**Piston** is a real-time, voice-first Retrieval-Augmented Generation (RAG) agent. You speak naturally — Piston listens, searches your uploaded documents, and replies in voice within seconds.

It's designed for scenarios where speed and naturalness matter:
- 🎤 **Interview Prep** — ask "What are my key skills on this resume?"
- 📄 **Document Q&A** — "What's the deadline in this contract?"
- 🔍 **Resume Screening** — "Rate these candidates against the job description."
- 📊 **Research** — "Summarize the methodology in this paper."
- 📝 **Comparison** — "Compare candidate A and B across these five criteria."

> Piston never guesses — it only answers from what you've uploaded. If it can't find the information, it says so honestly.

---

## 🎯 Key Features

| Feature | Description |
|---|---|
| 🎙️ **Real-Time Voice I/O** | Full-duplex audio via WebSocket. Speak, get spoken answers. No push-to-talk required. |
| 🧠 **Grounded-Only Answers** | Piston is hard-constrained to *only* answer from uploaded documents — no hallucination. |
| 📎 **Multi-Document Support** | Upload multiple PDFs, TXT, or Markdown files. Context selector lets you focus on one or all. |
| 🔁 **LangGraph RAG Pipeline** | A 4-step graph: **Rewrite → Retrieve → Grade → Synthesize** with per-node latency tracing. |
| 🛡️ **Relevance Gating** | A cosine score floor + LLM grader prevents irrelevant chunks from being used in answers. |
| 🗣️ **Query Rewriting** | Spoken questions are rewritten into clean retrieval queries before hitting the vector store. |
| 📱 **Responsive UI** | Dark/light mode, collapsible panels, mobile-ready layout with live transcript stream. |
| ⚡ **Interrupt & Mute** | Interrupt Piston mid-sentence or mute yourself without dropping the connection. |
| 💾 **Persistent Transcript** | Chat history is saved to `localStorage` and restored on refresh. |
| 🧪 **Offline Test Suite** | All RAG plumbing (parsing, FAISS, LangGraph, tools) verified without needing an API key. |
| 🔊 **Voice Selection** | Choose from multiple Gemini TTS voices (Kore, Puck, Charon, Aoede, etc.). |
| 📡 **Health Endpoint** | `/health` endpoint for uptime monitoring and readiness checks. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER (UI)                          │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │  Document Panel  │    │  Center Stage (Orb + Controls)  │  │
│  │  • Upload        │    │  • Animated Orb (idle/listen/   │  │
│  │  • List/Search   │    │    speak/search states)         │  │
│  │  • Context Select│    │  • Mute / Interrupt / End       │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│                                                              │
│  PCM 16k ──► WebSocket /ws ──► FastAPI  ◄── Binary PCM 24k  │
│  JSON text  ◄────────────────────────────► JSON events       │
└──────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    FastAPI App     │
                    │                   │
                    │  /         → UI   │
                    │  /upload   → RAG  │
                    │  /ws       → Live │
                    │  /health   → OK   │
                    └─────────┬─────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
      ┌────────▼────────┐         ┌──────────▼──────────┐
      │  Gemini Live    │         │   LangGraph RAG      │
      │  (gemini-3.8-   │         │   Pipeline           │
      │   live)         │         │                      │
      │                 │         │  Rewrite → Retrieve  │
      │  Audio ↔        │         │  → Grade → Synthesize│
      │  Transcription  │◄────────│                      │
      │  Tool Calls     │  answer │  FAISS VectorStore   │
      └─────────────────┘         │  Gemini Embeddings   │
                                  └──────────────────────┘
```

---

## 🔬 How It Works

### RAG Pipeline Deep-Dive

The heart of Piston is a **4-node LangGraph pipeline** (`app/rag/graph.py`) that runs every time the AI calls `search_knowledge_base`:

```
User speaks → Gemini Live → tool call: search_knowledge_base(question)
                                              │
                              ┌───────────────▼───────────────┐
                              │          REWRITE               │
                              │  Gemini Flash rewrites the     │
                              │  spoken query into a clean     │
                              │  keyword-rich retrieval query  │
                              └───────────────┬───────────────┘
                                              │
                              ┌───────────────▼───────────────┐
                              │          RETRIEVE              │
                              │  FAISS cosine search over     │
                              │  L2-normalized embeddings     │
                              │  TOP_K = 4 chunks returned    │
                              └───────────────┬───────────────┘
                                              │
                              ┌───────────────▼───────────────┐
                              │           GRADE                │
                              │  Cosine score floor: 0.35     │
                              │  If above floor → LLM grader  │
                              │  asks YES/NO for relevance    │
                              └───────────┬───────────┬───────┘
                                          │           │
                                      relevant       none
                                          │           │
                         ┌────────────────▼─┐   ┌────▼──────────────┐
                         │    SYNTHESIZE     │   │    NO_ANSWER       │
                         │  LLM compresses  │   │  Graceful decline  │
                         │  chunks into 2-3 │   │  "I couldn't find  │
                         │  spoken sentences│   │   that in your     │
                         └──────────────────┘   │   documents."      │
                                                └────────────────────┘
```

**Why this design?**
- **Rewrite** — voice input is noisy ("uh what does it say about the deadline"). Rewriting transforms it into a precise vector search query.
- **Grade** — the #1 failure of voice RAG is hallucinating from irrelevant chunks. The grader hard-blocks irrelevant results.
- **Synthesize** — voice answers must be spoken, not formatted. The synthesizer constrains output to 2-3 plain sentences.
- **Per-node latency tracing** — every node records its duration. The UI displays this in the transcript trace chips.

### WebSocket Audio Bridge

`app/live_session.py` is a concurrent asyncio bridge:

```
Browser                   FastAPI                  Gemini Live
──────                    ───────                  ───────────
mic PCM 16k  ────binary──►  session.send_realtime_input()
             ◄─binary──────                 ◄──── PCM 24k audio
ctrl JSON    ────text───►   ping/pong
             ◄─text────────  transcript / tool / status events
```

Two concurrent tasks run per session:
- **`browser_to_gemini()`** — reads mic audio binary frames and control JSON from the browser WebSocket, forwards raw PCM to Gemini.
- **`gemini_to_browser()`** — reads Gemini output (audio parts, transcripts, tool calls), forwards audio as binary frames and events as JSON.

**Tool dispatch** happens inline in `gemini_to_browser()`. When Gemini calls `search_knowledge_base`, the bridge:
1. Sends `{ type: "tool", status: "running" }` to the UI (shows spinner)
2. Runs `rag_service.ask(question)` via `asyncio.to_thread` (non-blocking)
3. Sends `FunctionResponse` back to Gemini with the answer + sources
4. Sends `{ type: "tool", status: "done", trace: [...] }` to the UI

### Frontend & UI

The frontend (`static/app.js`, `static/index.html`, `static/piston.css`) is a **vanilla JS + CSS** SPA with no build step:

- **Orb** — central animated button. CSS classes (`state-idle`, `state-listening`, `state-speaking`, `state-searching`, `state-error`) drive all visual states via animated rings and gradients.
- **PCM Worklet** — `pcm-worklet.js` runs in an `AudioWorkletProcessor` to efficiently capture mic audio as 16kHz Int16 PCM without blocking the main thread.
- **Interrupt detection** — if mic RMS > 0.03 while agent is speaking, the UI immediately flushes the audio buffer and signals interruption.
- **Inactivity timer** — 15-second silence timeout automatically ends the session cleanly.
- **Context selector** — a dropdown lets the user focus on a specific document or all documents. The active document name shows in the center stage.

---

## 📁 Project Structure

```
voice-rag-agent/
│
├── app/                        # Backend Python package
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, routes, lifespan
│   ├── config.py               # Env vars, model config, system instruction
│   ├── live_session.py         # WebSocket ↔ Gemini Live bridge
│   ├── tools.py                # Tool declarations & dispatch
│   └── rag/
│       ├── __init__.py
│       ├── embeddings.py       # Gemini embedder + offline hash embedder
│       ├── graph.py            # LangGraph RAG pipeline (rewrite→retrieve→grade→synthesize)
│       ├── kb.py               # Document parsing & chunking (PDF, TXT, MD)
│       └── store.py            # FAISS in-memory vector store
│
├── static/                     # Frontend (served by FastAPI)
│   ├── index.html              # App shell (3-panel layout)
│   ├── app.js                  # All frontend logic (~700 lines)
│   ├── piston.css              # Full design system & animations (~600 lines)
│   ├── pcm-worklet.js          # AudioWorklet for real-time PCM capture
│   └── assets/
│       └── piston-brand/       # Logos, favicons, brand assets
│
├── scripts/
│   ├── test_offline.py         # Offline unit tests (no API key needed)
│   └── test_rag_live.py        # Live integration tests (API key required)
│
├── .env.example                # Environment variable template
├── .env                        # Your local config (gitignored)
├── requirements.txt            # Python dependencies
├── run.py                      # Convenience entry point
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10 or newer |
| Google API Key | [Get a free key at Google AI Studio](https://aistudio.google.com/apikey) |
| A modern browser | Chrome 110+, Firefox 110+, Edge 110+ |

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/SuryaK999/Piston-VOICE-RAG.git
cd Piston-VOICE-RAG
```

**2. Create and activate a virtual environment**

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python -m venv .venv
source .venv/bin/activate
```

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

> ℹ️ **Note:** `faiss-cpu` requires no GPU. If you have a CUDA-capable GPU, you can substitute `faiss-gpu` for faster similarity search at large scale.

### Configuration

**4. Copy the example env file**

```bash
cp .env.example .env
```

**5. Add your Google API key**

Open `.env` in any editor and set:

```env
# .env

# Required — get a free key at https://aistudio.google.com/apikey
GOOGLE_API_KEY=your_actual_key_here

# Optional overrides (defaults are shown)
LIVE_MODEL=gemini-3.8-live
TEXT_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
VOICE_NAME=Kore
```

### Running the App

**6. Start the server**

```bash
python run.py
```

Or use uvicorn directly with hot-reload for development:

```bash
uvicorn app.main:app --reload --port 8000
```

**7. Open your browser**

Navigate to **[http://localhost:8000](http://localhost:8000)**

**8. Upload a document, then speak!**

1. Click **Upload** in the top bar and select a PDF, TXT, or Markdown file.
2. Wait for the "Indexed" status badge to appear next to your document.
3. Click the **animated orb** to start a voice session.
4. Grant microphone permission when prompted.
5. **Speak your question** — Piston will search and reply in voice.

---

## ⚙️ Configuration Reference

All configuration is done via environment variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_API_KEY` | *(required)* | Your Google AI Studio API key |
| `LIVE_MODEL` | `gemini-3.8-live` | Gemini Live model for voice I/O |
| `TEXT_MODEL` | `gemini-2.5-flash` | Gemini model for RAG (rewrite/grade/synthesize) |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Model for generating text embeddings (dim=768) |
| `VOICE_NAME` | `Kore` | TTS voice for Piston's responses |

**Available voice names:** `Kore`, `Puck`, `Charon`, `Aoede`, `Fenrir`, `Leda`, `Orus`, `Zephyr`

---

## 📡 API Reference

### `GET /`
Serves the main web application (`index.html`).

---

### `GET /health`
Returns server health and readiness status.

**Response:**
```json
{
  "ok": true,
  "kb_ready": true,
  "live_model": "gemini-3.8-live"
}
```

- `kb_ready: true` — RAG service initialized, API key is valid
- `kb_ready: false` — Missing or invalid `GOOGLE_API_KEY`

---

### `POST /upload`
Upload a document to the knowledge base (vector store).

**Request:** `multipart/form-data` with a `file` field.

**Accepted formats:** `.pdf`, `.txt`, `.md`

**Response (success):**
```json
{
  "message": "Processed 12 chunks from my_resume.pdf."
}
```

**Response (error):**
```json
{
  "error": "No readable text found in the file."
}
```

---

### `WebSocket /ws`
Real-time audio bidirectional bridge.

**Binary frames (browser → server):** Raw PCM Int16 audio at 16,000 Hz, mono.

**Binary frames (server → browser):** Raw PCM Int16 audio at 24,000 Hz, mono.

**Text frames (server → browser):** JSON event messages:

| `type` | Fields | Description |
|---|---|---|
| `status` | `status: "ready"` | Session initialized, microphone can start |
| `transcript` | `role, text` | Live transcript fragment |
| `turn_complete` | — | Agent finished speaking, new turn starts |
| `tool` | `name, detail, status, trace, latency_ms, sources` | RAG tool call event |
| `interrupted` | — | Agent speech interrupted by user |
| `end_session` | — | Session ended by voice command |
| `error` | `message` | Fatal session error |

---

## 🧪 Testing

### Offline Tests (no API key required)

Tests all RAG plumbing: document parsing, FAISS store, LangGraph graph wiring, and tool declarations — using a deterministic hash embedder instead of Gemini.

```bash
python scripts/test_offline.py
```

**What it tests:**
- ✅ Markdown section splitting and chunk structure
- ✅ Plain text fallback parsing
- ✅ FAISS index build, search, and dynamic `add_chunks`
- ✅ Empty store edge case
- ✅ LangGraph graph: relevant path (stub LLM says YES)
- ✅ LangGraph graph: graceful `no_answer` path (stub LLM says NO)
- ✅ Tool declarations (count, names)

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

### Live Integration Tests

Requires a valid `GOOGLE_API_KEY` and a running server.

```bash
python scripts/test_rag_live.py
```

---

## 🤖 AI Persona — "Piston"

Piston has a carefully tuned system instruction that enforces strict RAG-grounded behavior. Key behaviors:

| Rule | Behavior |
|---|---|
| 🔒 **Grounded-only answers** | MUST call `search_knowledge_base` before answering ANY content question. Never answers from general knowledge. |
| 📏 **Short responses** | Max 2-3 sentences. Designed for voice — no markdown, no bullet points. |
| 🎯 **Direct & specific** | Never asks "What would you like to know?" — searches first, answers directly. |
| 🙅 **Honest when stuck** | "I couldn't find that in your uploaded documents." |
| 🏷️ **Identity** | Name: **Piston**. Creator: **Surya Prakash Kudupudi** |
| 📊 **Resume scoring** | Can rate, rank, and compare resumes/docs against user-defined criteria. |
| 🔄 **Context switching** | Can focus on a specific document when asked. |
| 🎭 **Tone adaptation** | Can adjust tone (professional, casual, etc.) on request. |
| ⚡ **Session end** | Recognizes "goodbye" / "stop" / "end call" → calls `end_session` tool. |

**Available Tools:**

| Tool | Description |
|---|---|
| `search_knowledge_base` | Runs the full LangGraph RAG pipeline. Returns answer + sources. |
| `end_session` | Gracefully closes the WebSocket session. |

---

## 🎨 UI & Design

Piston's interface is a **3-panel dark-first design** built with vanilla HTML, CSS, and JavaScript:

```
┌──────────────┬──────────────────────────┬───────────────────┐
│  Left Panel  │      Center Stage        │   Right Panel     │
│              │                          │                   │
│ Your Docs    │   ┌─────────────────┐    │  Live Transcript  │
│ ─────────── │   │                 │    │  ──────────────── │
│ 📄 doc1.pdf │   │   ◉ Piston Orb  │    │  You: "..."       │
│ 📝 notes.md │   │   (animated)    │    │  Piston: "..."    │
│              │   │                 │    │  [Tool trace]     │
│ [Search]     │   └─────────────────┘    │                   │
│              │                          │                   │
│ [? Guide]    │  [Mute] [Interrupt] [End]│                   │
└──────────────┴──────────────────────────┴───────────────────┘
```

**Orb States:**

| State | Color | Animation |
|---|---|---|
| 🔘 **Idle** | Silver/Gray | Subtle glow |
| 🟠 **Listening** | Orange | Pulsing rings scale with mic volume |
| 🔶 **Speaking** | Orange-White | Rings pulse with AI audio amplitude |
| 🔍 **Searching** | Orange (fast pulse) | Rapid animation while RAG runs |
| 🔴 **Error** | Red | Static error state |

**Additional UI features:**
- 🌙 **Dark/Light theme toggle** — persisted in `localStorage`
- 📱 **Mobile responsive** — left panel slides in/out as a drawer
- 🔍 **Document search filter** — filter uploaded docs by filename
- 📋 **Context dropdown** — select focus document from the orb area
- 💬 **Transcript persistence** — saved and restored across sessions
- 🗑️ **Clear transcript** — double-click the "Live transcript" header
- 📶 **Mini-waveform** — real-time animated bars in the transcript header

---

## 🔌 Technology Stack

### Backend

| Library | Version | Role |
|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com/) | ≥ 0.115 | ASGI web framework, REST + WebSocket |
| [Uvicorn](https://www.uvicorn.org/) | ≥ 0.30 | ASGI server (standard with WebSocket support) |
| [google-genai](https://pypi.org/project/google-genai/) | ≥ 1.30 | Google Gemini SDK (Live API, embeddings, text generation) |
| [LangGraph](https://langchain-ai.github.io/langgraph/) | ≥ 0.2.60 | RAG pipeline state graph orchestration |
| [FAISS](https://github.com/facebookresearch/faiss) | ≥ 1.8 (cpu) | In-memory vector similarity search (cosine via inner product on L2-normalized vectors) |
| [NumPy](https://numpy.org/) | ≥ 1.26 | Embedding math, PCM processing |
| [pypdf](https://pypdf.readthedocs.io/) | ≥ 4.0 | PDF text extraction |
| [python-dotenv](https://pypi.org/project/python-dotenv/) | ≥ 1.0 | `.env` file loading |
| [python-multipart](https://pypi.org/project/python-multipart/) | ≥ 0.0.6 | File upload support (FastAPI) |
| [websockets](https://websockets.readthedocs.io/) | ≥ 12.0 | Underlying WebSocket library |

### Frontend

| Technology | Role |
|---|---|
| Vanilla HTML5 | App structure (semantic, accessible) |
| Vanilla CSS3 | Full design system — CSS variables, animations, responsive grid |
| Vanilla JavaScript (ES2020+) | WebSocket client, AudioContext, AudioWorklet, DOM |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | PCM capture, PCM playback |
| [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) | Off-main-thread PCM 16k capture (pcm-worklet.js) |
| [Google Fonts](https://fonts.google.com/) | Inter (UI) + Playfair Display (brand) |

### AI Models (Google Gemini)

| Model | Role |
|---|---|
| `gemini-3.8-live` | Real-time voice input/output (Live API) |
| `gemini-2.5-flash` | RAG reasoning — query rewrite, relevance grading, answer synthesis |
| `gemini-embedding-001` | Text embeddings (768 dimensions, L2-normalized) |

---

## 🛣️ Roadmap

- [ ] **Persistent vector store** — Save/load FAISS index to disk so uploaded docs survive server restarts
- [ ] **Multi-user sessions** — Per-session isolated knowledge bases
- [ ] **Streaming answers** — Stream synthesized text to UI while audio plays
- [ ] **DOCX support** — Add Microsoft Word document parsing
- [ ] **Document deletion** — Remove individual documents from the knowledge base
- [ ] **Session recording** — Export voice session as audio or transcript
- [ ] **Docker image** — One-command containerized deployment
- [ ] **Hybrid search** — BM25 + semantic re-ranking for improved retrieval

---

## 👨‍💻 Developer

<div align="center">

Built with ❤️ by **Surya Prakash Kudupudi**

[![GitHub](https://img.shields.io/badge/GitHub-SuryaK999-181717?style=for-the-badge&logo=github)](https://github.com/SuryaK999)

*"Your documents deserve to speak."*

</div>

---

<div align="center">

**[⬆ Back to Top](#️-piston--voice-rag-agent)**

<br/>

*Piston is an independent project and is not affiliated with Google LLC.*

</div>
