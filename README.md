# Helix AI — Knowledge Capture Agent

> **Transforming human expertise into structured, searchable organisational intelligence — via voice or text.**

---

## 🧠 What is Helix AI?

When experienced employees leave an organisation, they take **years of undocumented expertise** with them — workflows, contacts, workarounds, and institutional judgment that no manual captures.

**Helix AI** solves this with an intelligent AI agent named **Alex** that conducts structured interviews with employees (via text or voice), automatically extracts and classifies their knowledge, and stores it in a searchable knowledge base — ready for future colleagues to query in plain English.

---

## ✨ Features

- 🎤 **Dual Interview Modes** — Messenger-style **Text Agent** and hands-free **Voice Agent** (speech-to-text + TTS) powered by the Web Speech API. Employees can choose how they're most comfortable sharing knowledge.

- 📄 **Document-Aware Context** — Upload PDFs, DOCX, DOC, PNG, or JPG files. Alex reads them using `pdfplumber` and `python-docx`, then asks **specific questions** referencing the actual systems, tools, and processes in those documents — not generic templates.

- 🧠 **Intelligent Extraction Pipeline** — Every employee response triggers a secondary LLM call (LLaMA 3.1 8B) that extracts structured knowledge chunks with **domain classification** (process, technical, relationship, tacit, contact, company), **confidence scoring**, and linked person/system detection.

- 🔍 **Ask Alex Query Mode** — Switch from interview to query mode and ask Alex anything in plain English. Alex answers from uploaded documents **and** captured interview knowledge, citing sources.

- 📊 **Knowledge Hub** — Browse all captured knowledge across five views: Overview stats, By Topic (accordion with confidence bars), By Date (timeline), By Employee (domain breakdown), and full Conversation transcripts.

- 🔗 **Resource Management** — Eight dedicated pages (Docupedia, SharePoint, Teams, Outlook, Jira, SolMan, Signavio, Track & Release) with full CRUD, colour-coded tag filtering, and live search. All resource entries are also injected into Alex's context.

- 🏠 **Professional Dashboard** — Home page with live stats, About page with tech stack breakdown, and Help page with FAQs and quick-start guide.

---

## 🏗️ Architecture & Project Structure

```
helix-ai/
├── backend/                        # FastAPI Python server
│   ├── main.py                     # App entry point — registers all routers
│   ├── database.py                 # SQLite setup, table creation, context manager
│   ├── requirements.txt            # Python dependencies
│   ├── .env.example                # Environment variable template
│   ├── data/
│   │   └── knowledge_agent.db      # SQLite database (auto-created on first run)
│   ├── uploads/                    # Uploaded files stored here (auto-created)
│   ├── prompts/
│   │   ├── conversation.txt        # Alex interview prompt (LLaMA 3.3 70B)
│   │   └── extraction.txt          # Knowledge extraction prompt (LLaMA 3.1 8B)
│   └── routers/
│       ├── voice.py                # Interview sessions, turns, Ask Alex query endpoint
│       ├── files.py                # File upload, text extraction, LLM context serving
│       ├── resources.py            # CRUD for all 8 resource pages
│       └── knowledge.py            # Knowledge chunks, sessions, stats, summary
│
└── frontend/                       # React + Vite SPA
    ├── index.html                  # HTML entry point
    ├── vite.config.js              # Vite config with /api proxy to :8000
    ├── package.json
    └── src/
        ├── main.jsx                # React root
        ├── App.jsx                 # Theme, router, route definitions
        ├── components/
        │   └── Layout.jsx          # Fixed sidebar + navbar shell
        └── pages/
            ├── Home.jsx            # Landing page with live stats + agent cards
            ├── TextAgent.jsx       # Messenger-style chat (interview + query)
            ├── VoiceAgent.jsx      # Voice interview with mic + live transcript
            ├── UploadFiles.jsx     # Drag-drop file upload with preview
            ├── KnowledgeHub.jsx    # Analytics — 5-tab knowledge browser
            ├── ResourcePage.jsx    # Reusable CRUD page for all 8 resource types
            ├── About.jsx           # Tech stack + mission
            └── Help.jsx            # FAQs + quick-start guide
```

### Key Module Responsibilities

| Module | Responsibility |
|---|---|
| `voice.py` | Interview session lifecycle, LLM conversation, knowledge extraction, Ask Alex `/api/query` endpoint, document + resource context injection |
| `files.py` | Multipart file upload, text extraction (PDF/DOCX/image), file serving for preview, LLM context aggregation |
| `resources.py` | CRUD for all 8 resource types, tag support, LLM context formatting per resource |
| `knowledge.py` | Knowledge chunk retrieval, session history, stats, summary overview |
| `database.py` | SQLite initialisation, 4-table schema, WAL mode, context manager for safe transactions |
| `Layout.jsx` | Collapsible sidebar, active route highlighting, navbar with Home/About/Help navigation |
| `KnowledgeHub.jsx` | Overview cards, By Topic accordions, By Date timeline, By Employee two-panel, Conversation transcript viewer |

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | [python.org](https://python.org/downloads) — check "Add to PATH" during install |
| Node.js | 18+ LTS | [nodejs.org](https://nodejs.org/en/download) |
| Google Chrome | Latest | Required for Voice Agent (Web Speech API) |
| Groq API Key | Free | [console.groq.com](https://console.groq.com) → API Keys → Create |

---

### Installation

**1. Extract the ZIP file**
Extract the project ZIP to any folder on your laptop.
Example: C:\Projects\helix-ai\


**2. Backend setup**

```bash

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn python-multipart pdfplumber Pillow groq python-dotenv python-docx

# Create your environment file
cp .env.example .env
```

Open `.env` and fill in your values:

```env
GROQ_API_KEY=gsk_your_key_here
HTTP_PROXY=                         # Leave blank if not behind a corporate proxy
                                    # Example: http://127.0.0.1:3128
```

**3. Frontend setup**

```bash
# In a new terminal
cd frontend
npm install
```

---

### Running Locally

**Terminal 1 — Backend**

```bash
cd backend
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
python main.py
uvicorn main:app --reload --port 8000 (optional if any error occurs)
```

Expected output:
```
[DB] SQLite initialized at data\knowledge_agent.db
[OK] GROQ_API_KEY loaded (starts with: gsk_xxxx...)
Uvicorn running on http://0.0.0.0:8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.x  ready in 400ms
➜  Local:   http://localhost:5173/
```

Open **Google Chrome** and navigate to `http://localhost:5173`

> ⚠️ Both terminals must remain open simultaneously. The frontend proxies all `/api` requests to the backend on port 8000 via `vite.config.js`.

---

## ⚙️ Configuration

### Environment Variables (`backend/.env`)

| Variable | Type | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | `string` | **required** | Your Groq API key. Get one free at [console.groq.com](https://console.groq.com). Starts with `gsk_`. |
| `HTTP_PROXY` | `string` | `""` | Corporate proxy URL for outbound HTTPS. Example: `http://127.0.0.1:3128`. Leave blank if not required. |

### Database Schema

Four SQLite tables are auto-created on first run:

| Table | Purpose |
|---|---|
| `sessions` | One row per interview session. Stores user name, status, full conversation history (JSON), topics covered, and chunk count. |
| `knowledge_chunks` | One row per extracted knowledge item. Stores topic, domain, content, confidence score, linked person/system, follow-up flag. |
| `uploaded_files` | Metadata and extracted text for every uploaded file. `text_extracted=1` means ready for LLM context. |
| `resources` | All entries from the 8 resource management pages. Stores title, link, description, tags, and resource key. |

---

## 📖 Usage Examples

### Start a Text Interview

1. Open `http://localhost:5173`
2. Click **Text Agent** in the sidebar
3. Select **🎤 Interview Mode** from the dropdown
4. Enter your name → click **Start Session**
5. Alex begins asking structured questions about your role

### Query the Knowledge Base

1. In Text Agent, switch the dropdown to **🔍 Ask Alex**
2. Type any question in natural language:

```
"What did Harsh discuss about the voice agent?"
"What topics were covered on 2025-06-19?"
"Tell me about EV charging from the uploaded document"
```

Alex searches both uploaded documents and captured interview knowledge, then responds with cited answers.

### Upload a Document for Context

```
Upload Files → drag & drop your PDF or DOCX
```

Supported formats: `.pdf`, `.docx`, `.doc`, `.png`, `.jpg`, `.webp`

Once uploaded, Alex automatically reads the document during all future interviews and Ask Alex queries.

### Verify Everything is Working

```Open in browser

# Backend health check
 http://localhost:8000/api/health

# Groq API connectivity
 http://localhost:8000/api/test/groq

# Document context check (shows what Alex is reading)
 http://localhost:8000/api/test/context
```

### Add a Resource Entry (e.g. Jira)

1. Click **Jira** in the sidebar
2. Click **Add Resource**
3. Fill in Title, URL, Description, Tags (comma-separated)
4. Click **Create** — appears instantly in the table

---


**Suggested future enhancements:**
- Web scraping — paste a URL and Alex reads the page as context
- PostgreSQL migration for production deployments
- Multi-language interview support
- Export knowledge base to Excel / PDF report
- Authentication and user roles

