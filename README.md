<div align="center">

<br/>

<img src="https://raw.githubusercontent.com/SuryaK999/Piston-VOICE-RAG/main/static/assets/piston-brand/piston-mark-192.png" width="88" height="88" alt="Piston Mark" />

# Piston — Voice RAG Agent

**Talk to your documents. Get real answers. Instantly.**

*A production-grade, real-time voice AI assistant that lets you speak naturally to your uploaded documents — powered by Google Gemini Live, a 4-node LangGraph RAG pipeline, local IndexedDB browser persistence, and a 60 FPS organic fluid visualizer.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-Live%20API-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2%2B-FF6B35?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![FAISS](https://img.shields.io/badge/FAISS-Persistent%20VectorStore-00A896?style=for-the-badge)](https://github.com/facebookresearch/faiss)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-Client%20Persistence-E34F26?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
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
  - [Embedding & Vector Store (RAM + Disk)](#embedding--vector-store-ram--disk)
  - [Audio Engine & Half-Duplex Echo Prevention](#audio-engine--half-duplex-echo-prevention)
  - [Browser IndexedDB Persistence (PistonDB)](#browser-indexeddb-persistence-pistondb)
  - [Cinematic Fluid Visualizer (Orb.js)](#cinematic-fluid-visualizer-orbjs)
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
- [⌨️ Keyboard Shortcuts](#️-keyboard-shortcuts)
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
| 🎙️ **Real-Time Voice I/O** | Full-duplex WebSocket audio (16kHz Int16 mic input, 24kHz Int16 Gemini speech output) with zero push-to-talk. |
| 🛡️ **Half-Duplex Acoustic Gating** | Prevents AI speaker audio from leaking into the microphone, eliminating self-interruption and sentence cut-offs. |
| 🧠 **Grounded-Only Answers** | Hard-constrained to answer *only* from uploaded documents — hallucination is architecturally prevented. |
| 💾 **Client-Side IndexedDB (`PistonDB`)** | All uploaded documents, active document selection, theme, and transcripts survive browser refreshes without data loss. |
| 🗄️ **Full Document CRUD & Controls** | Upload, search, view chunk counts, delete individual documents, or clear all documents on demand with instant index updates. |
| 🔄 **Server Disk Persistence** | FAISS vector store and chunk metadata serialize to `data/piston_store.faiss` and `data/piston_chunks.pkl`. |
| 🔁 **LangGraph RAG Pipeline** | 4-node graph: **Rewrite → Retrieve → Grade → Synthesize** with per-node millisecond latency tracing. |
| 🌊 **60 FPS Organic Fluid Visualizer** | Multi-pass Canvas 2D engine with volumetric atmospheric aura, harmonic wave membrane, 3D glint, and acoustic particles. |
| 🛡️ **Relevance Gating** | Cosine score floor (0.35) + LLM YES/NO grader prevents irrelevant chunks from reaching the answer. |
| 🗣️ **Query Rewriting** | Spoken queries (often messy) are rewritten into clean keyword-rich retrieval queries before FAISS search. |
| 📱 **Responsive Neo-Grotesque UI** | Dark-first aesthetic, frosted glass docks, dual collapsible sidebars (`[` and `]`), and mobile drawer layout. |
| ⚡ **Interrupt & Mute** | Interrupt Piston mid-sentence by speaking or tapping Stop, or mute your mic without dropping the WebSocket. |
| ⏱️ **Inactivity Management** | 10-minute graceful silence timeout with descending audio cue; 15s WebSocket heartbeat ping/pong. |
| 🧪 **Comprehensive Test Suite** | 30/30 offline tests (zero API key needed) plus live end-to-end CRUD verification suite. |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BROWSER CLIENT (UI)                           │
│                                                                        │
│  ┌──────────────────┐    ┌──────────────────────────────────────────┐  │
│  │   Left Panel     │    │            Center Stage                  │  │
│  │  ─────────────── │    │  ┌────────────────────────────────────┐  │  │
│  │  • Upload files  │    │  │ 60FPS Canvas 2D Fluid Visualizer   │  │  │
│  │  • Delete docs   │    │  │ (Aura + Harmonic Wave + 3D Glint)  │  │  │
│  │  • Chunk badges  │    │  └────────────────────────────────────┘  │  │
│  │  • Filter search │    │  ╔════════════════════════════════════╗  │  │
│  │  • Collapse ([)  │    │  ║ Floating Context Capsule Dock      ║  │  │
│  └────────┬─────────┘    │  ╚════════════════════════════════════╝  │  │
│           │              │  [Mute]       [Interrupt]       [End]    │  │
│  ┌────────▼─────────┐    └──────────────────────────────────────────┘  │
│  │    PistonDB      │                                                  │
│  │  (IndexedDB v1)  │    Right Panel: Live Transcript + Latency Chips  │
│  │  • documents     │                                                  │
│  │  • transcripts   │    mic PCM 16kHz ──binary──► WS /ws ◄─── PCM 24k │
│  │  • settings      │    JSON ctrl msgs ──text───►        ◄─── Events  │
│  └──────────────────┘                                                  │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
                           ┌──────────┴──────────┐
                           │     FastAPI App     │
                           │  GET  /             │
                           │  POST /upload       │
                           │  GET  /documents    │
                           │  DEL  /documents    │
                           │  WS   /ws           │
                           │  GET  /health       │
                           └──────────┬──────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   │                                     │
          ┌────────▼────────────┐            ┌───────────▼─────────────┐
          │   Gemini Live API   │            │  LangGraph RAG Pipeline │
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
                                             │  data/piston_store.faiss│
                                             │  data/piston_chunks.pkl │
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
                               │  Filtered by target doc (if set)│
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

---

### Document Parsing & Chunking

Defined in `app/rag/kb.py`. Handles multiple formats:

* **PDF** (via `pypdf`): Full text extracted page by page, concatenated with double-newlines.
* **Text / Markdown / plain `.txt`**: Split on `# ` or `## ` section headers using regex. Chunks over **1,200 characters** are further split on paragraph breaks (`\n\n`) to preserve semantic retrieval granularity.
* Each chunk preserves its source filename and section title in a `source_label` (`"report.pdf › Executive Summary"`).

---

### Embedding & Vector Store (RAM + Disk)

Defined in `app/rag/embeddings.py` and `app/rag/store.py`:
* **Embeddings**: `gemini-embedding-001` (768 dimensions), L2-normalized so inner product equals cosine similarity. Batched in groups of 50 with rate-limit backoff.
* **FAISS `IndexFlatIP`**: High-performance in-memory search with dynamic insertion (`add_chunks`) and document deletion (`remove_document`).
* **Disk Persistence**: `VectorStore.save("data/piston_store")` writes both the FAISS binary index and chunks metadata. At startup, `VectorStore.load()` restores the knowledge base automatically.

---

### Audio Engine & Half-Duplex Echo Prevention

To guarantee crystal-clear conversations without accidental interruptions:
1. **Half-Duplex Acoustic Gating (`isModelSpeaking`)**: While Gemini is speaking, incoming mic audio packets are gated and not forwarded as interrupt triggers unless intentional user volume exceeds a dedicated threshold.
2. **AudioWorklet (`pcm-worklet.js`)**: Dedicated audio thread records 16kHz 16-bit PCM without blocking the UI.
3. **Web Audio Timeline Scheduling**: Output 24kHz PCM chunks are scheduled using a continuous `nextPlayTime` cursor (`Math.max(audioContext.currentTime + 0.05, nextPlayTime)`), preventing crackles, buffer starvation, or mid-sentence cut-offs.

---

### Browser IndexedDB Persistence (PistonDB)

Defined in `static/db.js`:
* Zero-dependency client-side database (`PistonAgentDB`, version 1).
* **Object Stores**:
  * `documents`: Stores document metadata, raw text/base64 payloads, and chunk metrics.
  * `transcripts`: Stores conversation history and RAG tool execution traces.
  * `settings`: Stores user UI preferences (theme, panel state, active document).
* **Auto-Reconciliation**: On page reload, documents are instantly re-rendered in the UI and synced with the backend vector store.

---

### Cinematic Fluid Visualizer (Orb.js)

Defined in `static/orb.js`:
* Replaces static CSS circles with a 6-layer Canvas 2D organic fluid visualizer:
  * **Layer 1 (Volumetric Atmospheric Aura)**: 2.2x radial glow bloom that softens into the dark background.
  * **Layer 2 (Acoustic Radiant Ripples)**: Concentric soundwaves expanding on voice triggers.
  * **Layer 3 (Fluid Harmonic Wave Membrane)**: 16-point cubic Bezier wave deformation reacting dynamically to audio levels.
  * **Layer 4 (Orbiting Planetary Rings)**: Dashed orbital rings during document retrieval and thinking states.
  * **Layer 5 (3D Specular Glint)**: Soft spherical highlight tracking mouse/pointer position.
  * **Layer 6 (Acoustic Particle Sparkles)**: Radiant particle bursts at volume peaks.

---

## 📁 Project Structure

```
voice-rag-agent/
│
├── app/                            # Python backend package
│   ├── __init__.py
│   ├── main.py                     # FastAPI app, REST CRUD routes, WebSocket endpoint
│   ├── config.py                   # Env variables, 15 system rules, model configurations
│   ├── live_session.py             # WebSocket ↔ Gemini Live asyncio bridge (2 concurrent tasks)
│   ├── tools.py                    # Tool declarations (search_knowledge_base, end_session)
│   └── rag/
│       ├── __init__.py
│       ├── embeddings.py           # Gemini embedder (768-dim, batched 50) + hash embedder
│       ├── graph.py                # LangGraph 4-node RAG pipeline (Rewrite→Retrieve→Grade→Synthesize)
│       ├── kb.py                   # Document parsers (PDF, Markdown, TXT)
│       └── store.py                # FAISS VectorStore with disk save/load and document deletion
│
├── static/                         # Vanilla frontend (zero build step)
│   ├── index.html                  # 3-panel semantic shell with frosted glass docks
│   ├── app.js                      # Core frontend controller, audio scheduling, WebSockets
│   ├── orb.js                      # 60 FPS Canvas 2D organic fluid visualizer
│   ├── db.js                       # Client-side IndexedDB persistence engine (PistonDB)
│   ├── piston.css                  # Neo-Grotesque design system and theme variables
│   ├── pcm-worklet.js              # AudioWorkletProcessor — off-thread 16kHz PCM capture
│   └── assets/
│       └── piston-brand/           # SVG marks, wordmarks, and multi-res favicons
│
├── data/                           # Serialized FAISS vector store and chunk metadata
│
├── scripts/
│   ├── test_offline.py             # 30-check comprehensive offline test (no API key needed)
│   ├── test_live_crud.py           # Live HTTP CRUD & document persistence test
│   └── test_rag_live.py            # Live Gemini API RAG integration test
│
├── .env.example                    # Environment template
├── .env                            # Local configuration (gitignored)
├── requirements.txt                # Pinned Python dependencies
├── run.py                          # Startup script (port 8000)
└── README.md                       # Project documentation
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Details |
|---|---|
| **Python** | 3.10 or newer |
| **Google API Key** | Free key from [Google AI Studio](https://aistudio.google.com/apikey) |
| **Browser** | Chrome 110+, Edge 110+, Firefox 110+, or Safari 16+ (Web Audio & AudioWorklet support) |
| **Microphone** | Standard microphone with browser audio permissions |

### Installation

```bash
# 1. Clone repository
git clone https://github.com/SuryaK999/Piston-VOICE-RAG.git
cd Piston-VOICE-RAG

# 2. Create virtual environment
python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and insert your Gemini API key:

```env
GOOGLE_API_KEY=your_actual_key_here
LIVE_MODEL=gemini-3.8-live
TEXT_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
VOICE_NAME=Kore
```

### Running the App

```bash
python run.py
```

Navigate to **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## ⚙️ Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_API_KEY` | *(required)* | Your Google AI Studio API key. |
| `LIVE_MODEL` | `gemini-3.8-live` | Real-time bidirectional voice model. |
| `TEXT_MODEL` | `gemini-2.5-flash` | Reasoning model for query rewrite, relevance grading, and synthesis. |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | 768-dimensional text embedding model. |
| `VOICE_NAME` | `Kore` | Spoken voice personality (`Kore`, `Puck`, `Charon`, `Aoede`, `Fenrir`, `Leda`, `Orus`, `Zephyr`). |

---

## 📡 API Reference

### Document Management & CRUD

* **`POST /upload`**: Uploads and indexes `.pdf`, `.txt`, or `.md` files. Returns document metadata and chunk counts.
* **`GET /documents`**: Returns JSON list of all currently indexed documents.
* **`DELETE /documents/{name}`**: Deletes a specific document from the FAISS vector store and updates disk storage.
* **`DELETE /documents`**: Clears all documents and resets the vector index.

### Voice & System Endpoints

* **`WebSocket /ws`**: Full-duplex audio and JSON event pipeline.
* **`GET /health`**: Returns system status, vector store readiness, and configured models.
* **`GET /`**: Serves the main single-page application.

---

## 🧪 Testing

### Offline Test Suite (No API Key Required)

Run 30 automated unit and architectural checks verifying document chunking, FAISS index operations, dynamic chunk insertion, document filtering, document deletion, persistence serialization, and LangGraph wiring:

```bash
python scripts/test_offline.py
```

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
== Document filtering ==
  [OK] filtered search returns target document
  [OK] filtered search with non-existent doc returns empty
== Document removal ==
  [OK] removed correct chunk count
  [OK] store size reverted
  [OK] removed doc no longer in store
== Persistence (Save & Load) ==
  [OK] loaded store exists
  [OK] loaded store index size matches
  [OK] loaded store chunks count matches
  [OK] loaded store search works
== Empty store ==
  [OK] empty store has 0 vectors
  [OK] empty store has 0 chunks
  [OK] add_chunks with [] is no-op
== LangGraph wiring (stub LLM) ==
  [OK] graph returns an answer string
  [OK] trace is a list
  [OK] latency_ms is a dict
  [OK] sources is a list
  [OK] filtered ask works
  [OK] irrelevant -> graceful no_answer
  [OK] no_answer has empty sources
== Tools ==
  [OK] two tools declared
  [OK] tool is search_knowledge_base

30 passed, 0 failed
```

### Live CRUD & Persistence Suite

Verify real HTTP upload, listing, filtering, and deletion against the running server:

```bash
python scripts/test_live_crud.py
```

---

## 🤖 AI Persona — "Piston"

Piston's voice behavior is governed by 15 strict behavioral guidelines in `app/config.py`:
1. **Grounded Answers Only**: Calls `search_knowledge_base` before answering any factual questions.
2. **Short & Spoken**: Answers in 2–3 concise sentences without markdown or bullet points.
3. **No Repeated Greetings**: Greets once upon session opening; avoids conversational clutter.
4. **Graceful Decline**: Honestly admits when information is not in the uploaded documents.
5. **Directness**: Answers queries immediately without filler preamble.
6. **Identity & Attribution**: Identifies as *Piston*, developed by *Surya Prakash Kudupudi*.
7. **Document Comparison & Summaries**: Supports side-by-side multi-document synthesis and comparisons.

---

## 🎨 UI & Design

Piston features a refined, dark-first interface crafted with semantic HTML5 and modern CSS custom properties:
* **Center Stage**: High-volume, breathing organic visualizer that deforms smoothly to user and AI speech.
* **Unified Dock**: Frosted glass floating context capsule showing active document scope with an instant dropdown picker.
* **Action Dock**: Ergonomic Mute, Interrupt, and End Session controls.
* **Dual Collapsible Panels**: Keep the focus on the voice conversation while preserving instant access to document libraries and transcripts.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Toggle Voice Session (Start / End) |
| `Esc` | Interrupt Piston or Stop active speech |
| `[` | Collapse / Expand Left Document Library |
| `]` | Collapse / Expand Right Transcript Panel |
| `Double Click` (Transcript Header) | Wipe transcript history from UI and IndexedDB |

---

## 🎨 Brand Assets

All brand identity files are located in `static/assets/piston-brand/`:
* `piston-mark.svg`: 5-bar acoustic waveform logomark in radiant orange (`#FF5A1F`).
* `piston-wordmark.svg` / `piston-wordmark-2x.png`: High-resolution brand wordmark.
* `piston-mark-192.png` & `piston-mark-512.png`: App icons and PWA assets.
* `favicon.svg` & `favicon.ico`: Multi-resolution browser favicons.

---

## 🔌 Technology Stack

### Backend
* **FastAPI** (`≥ 0.115`): High-speed async web framework for REST & WebSockets.
* **google-genai** (`≥ 1.30`): Official Google GenAI SDK for Gemini Live & Embeddings.
* **LangGraph** (`≥ 0.2.60`): Stateful multi-actor RAG graph orchestration.
* **FAISS (cpu)** (`≥ 1.8`): In-memory and disk-persisted vector similarity indexing.
* **pypdf** (`≥ 4.0`): Multi-page PDF text extraction.
* **NumPy** (`≥ 1.26`): Vector normalization and PCM audio operations.

### Frontend
* **Vanilla HTML5 & CSS3**: Zero-framework design system with CSS custom properties.
* **IndexedDB API**: Persistent client-side document and transcript database.
* **Web Audio API & AudioWorklet**: Off-thread 16kHz audio capture and 24kHz stream scheduling.
* **HTML5 Canvas 2D**: 60 FPS hardware-accelerated organic fluid visualizer.

---

## 🛣️ Roadmap

- [x] **Persistent vector store** — serialize and load FAISS indices to/from disk (`data/piston_store.faiss`)
- [x] **Client-side storage** — browser IndexedDB persistence so documents and chat history survive page reloads
- [x] **Document deletion** — full REST CRUD & UI controls to delete individual documents or clear the library
- [x] **Acoustic echo gating** — half-duplex voice gating to eliminate self-interruptions and cut-offs
- [x] **Cinematic UI visualizer** — multi-layer fluid harmonic wave orb with volumetric backlight glow
- [ ] **DOCX support** — parse Microsoft Word documents via `python-docx`
- [ ] **Hybrid retrieval** — combine BM25 sparse keyword search with dense semantic embeddings
- [ ] **Docker container** — single-command containerized deployment

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
