# Helix AI — Knowledge Capture Agent

> **Transforming human expertise into structured, searchable organisational intelligence — via voice, text, websites, or documents.**

---

## 🧠 What is Helix AI?

When experienced employees leave an organisation, they take **years of undocumented expertise** with them — workflows, contacts, workarounds, and institutional judgment that no manual captures.

**Helix AI** solves this with an intelligent AI agent named **Alex** that conducts structured interviews with employees (via text or voice), automatically extracts and classifies their knowledge, and stores it in a searchable knowledge base — ready for future colleagues to query in plain English.

Helix AI also supports **website URL analysis and PDF analysis**, allowing users to provide external website URLs or upload PDF documents and ask questions directly against their content.

---

## ✨ Features

* 🎤 **Dual Interview Modes** — Messenger-style **Text Agent** and hands-free **Voice Agent** (speech-to-text + TTS) powered by the Web Speech API. Employees can choose how they're most comfortable sharing knowledge.

* 📄 **Document-Aware Context** — Upload PDFs, DOCX, DOC, PNG, JPG, or WEBP files. Alex reads uploaded documents and uses their extracted content as context for interviews and knowledge queries.

* 🌐 **Upload URL Analysis** — Provide a website URL and ask questions about its content. Helix retrieves the website through **Firecrawl**, cleans the extracted Markdown, divides it into logical chunks, retrieves relevant content using local RAG, and generates a grounded answer using **Groq**.

* 📕 **Upload PDF Analysis** — Upload a PDF directly through the Helix interface. PDF text is extracted using **PyMuPDF**, processed for analysis, and supplied to the AI answer-generation pipeline.

* 💬 **PDF Conversation Support** — Continue asking follow-up questions about an uploaded PDF while maintaining the relevant document and conversation context.

* 🗂️ **PDF History & Persistence** — PDF analysis sessions and associated conversation information are persisted so that processed PDF conversations can be accessed through the application.

* 🧠 **Intelligent Extraction Pipeline** — Every employee response triggers a secondary LLM call (LLaMA 3.1 8B) that extracts structured knowledge chunks with **domain classification** (process, technical, relationship, tacit, contact, company), **confidence scoring**, and linked person/system detection.

* 🔍 **Ask Alex Query Mode** — Switch from interview to query mode and ask Alex anything in plain English. Alex answers from uploaded documents **and** captured interview knowledge, citing sources.

* 📊 **Knowledge Hub** — Browse all captured knowledge across five views: Overview stats, By Topic (accordion with confidence bars), By Date (timeline), By Employee (domain breakdown), and full Conversation transcripts.

* 🔗 **Resource Management** — Eight dedicated pages (Docupedia, SharePoint, Teams, Outlook, Jira, SolMan, Signavio, Track & Release) with full CRUD, colour-coded tag filtering, and live search. All resource entries are also injected into Alex's context.

* 🏠 **Professional Dashboard** — Home page with live stats, About page with tech stack breakdown, and Help page with FAQs and quick-start guide.

---

## 🏗️ Architecture & Project Structure

```text
helix-ai/
├── .gitignore
├── Proxy.bat                       # Bosch corporate proxy setup
├── README.md                       # Project documentation
├── .vscode/
│   └── settings.json               # VS Code project settings
│
├── backend/                        # FastAPI Python server
│   ├── .env                        # Environment variables and API keys
│   ├── database.py                 # SQLite setup, table creation, context manager
│   ├── main.py                     # App entry point — registers all routers
│   ├── requirements.txt            # Python dependencies
│   │
│   ├── data/
│   │   └── knowledge_agent.db      # SQLite database (auto-created on first run)
│   │
│   ├── prompts/
│   │   ├── conversation.txt        # Alex interview prompt
│   │   └── extraction.txt          # Knowledge extraction prompt
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── files.py                # File upload and document processing
│   │   ├── knowledge.py             # Knowledge chunks, sessions, stats and summary
│   │   ├── pdf.py                  # PDF analysis and PDF conversation endpoints
│   │   ├── resources.py            # CRUD for all resource pages
│   │   ├── text_chat.py             # Text Agent conversation endpoints
│   │   ├── uploads.py              # Uploaded-file related endpoints
│   │   ├── url.py                  # Website retrieval, RAG and URL answer generation
│   │   └── voice.py                # Voice Agent interview and conversation endpoints
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── answer_generator.py     # Groq-based grounded answer generation
│   │   ├── chunking_service.py     # Logical content chunking for RAG
│   │   ├── content_cleaner.py      # Extracted website content cleaning
│   │   ├── context_builder.py      # Source context preparation
│   │   ├── pdf_extractor.py        # PyMuPDF-based PDF text extraction
│   │   └── rag_service.py          # Local lexical relevance retrieval
│   │
│   └── uploads/                    # Runtime storage for uploaded documents
│
└── frontend/                       # React + Vite SPA
    ├── index.html                  # HTML entry point
    ├── package-lock.json           # Locked frontend dependencies
    ├── package.json                # Frontend dependencies and scripts
    ├── vite.config.js              # Vite config with /api proxy to :8000
    │
    └── src/
        ├── App.jsx                 # Theme, router and route definitions
        ├── index.css               # Global application styling
        ├── main.jsx                # React root
        │
        ├── components/
        │   ├── Layout.jsx          # Main application layout
        │   ├── WebResources.jsx    # Web resource component
        │   │
        │   └── layout/
        │       ├── Layout.css      # Layout-specific styling
        │       └── Layout.jsx      # Layout implementation
        │
        └── pages/
            ├── About.jsx            # Tech stack and project information
            ├── Agent.css            # Agent page styling
            ├── Help.jsx             # FAQs and help information
            ├── Home.jsx             # Landing page and dashboard
            ├── KnowledgeHub.jsx     # Knowledge analytics and browsing
            ├── Layout_old.jsx       # Previous layout implementation
            ├── ResourcePage.jsx     # Resource management page
            ├── TextAgent.jsx        # Text-based AI agent
            ├── UploadFiles.jsx      # General document upload interface
            ├── UploadPDF.jsx        # PDF upload and analysis interface
            ├── UploadURL.jsx        # URL analysis and website Q&A
            └── VoiceAgent.jsx       # Voice-based AI agent
```

### Key Module Responsibilities

| Module                | Responsibility                                                                 |
| --------------------- | ------------------------------------------------------------------------------ |
| `main.py`             | FastAPI application entry point and router registration                        |
| `database.py`         | SQLite initialisation, database schema and transaction management              |
| `voice.py`            | Voice Agent interview and conversation functionality                           |
| `text_chat.py`        | Text Agent conversation functionality                                          |
| `files.py`            | General file upload and document processing                                    |
| `uploads.py`          | Uploaded-file handling and related API operations                              |
| `pdf.py`              | PDF analysis, question answering and PDF conversation endpoints                |
| `url.py`              | Website retrieval, content processing, RAG retrieval and URL answer generation |
| `knowledge.py`        | Knowledge chunks, sessions, statistics and summaries                           |
| `resources.py`        | Resource management and CRUD operations                                        |
| `pdf_extractor.py`    | Extracts text from PDF documents using PyMuPDF                                 |
| `answer_generator.py` | Generates grounded answers using Groq                                          |
| `content_cleaner.py`  | Cleans and normalises extracted website content                                |
| `context_builder.py`  | Builds source context for AI answer generation                                 |
| `chunking_service.py` | Converts extracted website content into logical RAG chunks                     |
| `rag_service.py`      | Performs local lexical relevance retrieval and ranking                         |
| `Layout.jsx`          | Main frontend application layout and navigation                                |
| `WebResources.jsx`    | Web resource UI component                                                      |
| `UploadFiles.jsx`     | General document upload interface                                              |
| `UploadPDF.jsx`       | PDF upload, analysis and follow-up conversation interface                      |
| `UploadURL.jsx`       | URL submission, website analysis, generated answers and follow-up questions    |
| `KnowledgeHub.jsx`    | Knowledge browsing and analytics                                               |
| `ResourcePage.jsx`    | Reusable resource management interface                                         |
| `TextAgent.jsx`       | Text-based interview and query interface                                       |
| `VoiceAgent.jsx`      | Voice-based interview interface                                                |

---

## 🚀 Getting Started

### Prerequisites

| Requirement       | Version  | Notes                                                                           |
| ----------------- | -------- | ------------------------------------------------------------------------------- |
| Python            | 3.10+    | [python.org](https://python.org/downloads) — check "Add to PATH" during install |
| Node.js           | 18+ LTS  | [nodejs.org](https://nodejs.org/en/download)                                    |
| Google Chrome     | Latest   | Required for Voice Agent (Web Speech API)                                       |
| Groq API Key      | Free     | [console.groq.com](https://console.groq.com) → API Keys → Create                |
| Firecrawl API Key | Required | Required for Upload URL analysis                                                |

---

### Installation

**1. Extract the ZIP file**

Extract the project ZIP to any folder on your laptop.

Example:

```text
C:\Projects\helix-ai\
```

---

**2. Backend setup**

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

Create the environment file:

```text
backend/.env
```

Add the required API configuration:

```env
GROQ_API_KEY=gsk_your_key_here
FIRECRAWL_API_KEY=fc-your_key_here
```

If your environment requires a corporate proxy, configure it according to the Bosch network environment.

---

**3. Frontend setup**

```bash
cd frontend
npm install
```

---

## 🌐 Upload URL

The **Upload URL** feature allows Helix AI to analyse publicly accessible websites and answer questions using the extracted website content.

### URL Analysis Pipeline

```text
User enters URL + question
          ↓
       Firecrawl
          ↓
   Website Markdown
          ↓
   Content Cleaning
          ↓
    Logical Chunking
          ↓
      Local RAG
          ↓
 Relevant Source Chunks
          ↓
    Context Builder
          ↓
        Groq
          ↓
   Grounded AI Answer
          ↓
   Follow-up Questions
```

### Firecrawl

Firecrawl is used to retrieve the target website and convert its content into usable Markdown.

The retrieved information can include:

* Website title
* Source URL
* Main page content
* Headings
* Links
* Other relevant Markdown content

The retrieved content is then cleaned before being passed to the chunking and retrieval pipeline.

### Content Cleaning

The extracted website Markdown is cleaned and normalised while preserving useful content structure.

This prevents unnecessary website noise from being passed to the answer-generation model.

### Logical Chunking

The cleaned Markdown is divided into logical chunks.

Chunks are created around meaningful sections and content boundaries so that relevant information can be retrieved without sending the entire website to the model.

### Local RAG

Helix uses local lexical relevance retrieval for URL analysis.

The user's question is tokenised and compared against the headings and content of the website chunks.

The highest-ranked chunks are selected as context for answer generation.

### Groq Answer Generation

The selected source chunks are supplied to the Groq model:

```text
openai/gpt-oss-120b
```

The model generates an answer based on the retrieved website content.

### Follow-up Questions

After analysing a URL, users can continue asking questions about the same source.

The follow-up conversation maintains the relevant URL-analysis context so users can explore the website naturally.

---

## 📕 Upload PDF

The **Upload PDF** feature allows users to upload PDF documents and ask questions directly against their contents.

### PDF Analysis Pipeline

```text
PDF Upload
     ↓
PyMuPDF Extraction
     ↓
PDF Processing
     ↓
Extracted Source Content
     ↓
Context Preparation
     ↓
Groq
     ↓
Generated Answer
     ↓
Follow-up Conversation
     ↓
History / Persistence
```

### PyMuPDF

Helix uses **PyMuPDF** for PDF text extraction.

The uploaded PDF is processed and its text content is extracted for subsequent question answering.

### PDF Processing

After extraction, the document content is prepared for the answer-generation pipeline.

The user can ask questions about:

* document purpose
* key points
* technical information
* processes
* recommendations
* specific sections
* other information contained in the PDF

### PDF Conversation Support

Users can continue asking follow-up questions about the same uploaded PDF.

The conversation can use the previously established document context to answer subsequent questions.

### PDF History & Persistence

PDF analysis information and conversation history are persisted through the application's existing database layer.

---

## 🔐 Bosch Proxy Configuration

When running Helix AI inside the Bosch corporate environment, outbound connections to external services may require the configured Bosch corporate proxy.

The backend can be started with the required proxy environment variables before launching Uvicorn.

The project also contains:

```text
Proxy.bat
```

for the project-specific proxy setup.

The proxy implementation itself is environment-specific and is intentionally not documented in detail here.

---

## ▶️ Running Locally

### Terminal 1 — Backend

After completing the installation and activating the virtual environment:

```powershell
cd C:\Users\BBK5KOR\Desktop\Helix_AI\backend

$env:HTTP_PROXY="http://127.0.0.1:3128"

$env:HTTPS_PROXY="http://127.0.0.1:3128"

uvicorn main:app --reload --port 8000
```

Expected output:

```text
INFO:     Will watch for changes in these directories: ['C:\\Users\\BBK5KOR\\Desktop\\Helix_AI\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Started reloader process using WatchFiles
[DB] SQLite initialized at data\knowledge_agent.db
[OK] GROQ_API_KEY loaded
[OK] Proxy set to: http://127.0.0.1:3128
[GROQ] Answer generator initialized.
[GROQ] Model: openai/gpt-oss-120b
[GROQ] Client initialized.
[GROQ] Model: openai/gpt-oss-120b
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

### Terminal 2 — Frontend

Open a second terminal:

```powershell
cd C:\Users\BBK5KOR\Desktop\Helix_AI\frontend
npm run dev
```

Expected output:

```text
VITE v5.x  ready in 400ms
➜  Local:   http://localhost:5173/
```

Open **Google Chrome** and navigate to:

```text
http://localhost:5173
```

> ⚠️ Both terminals must remain open simultaneously. The frontend proxies `/api` requests to the backend running on port `8000`.

---

## ⚙️ Configuration

### Environment Variables (`backend/.env`)

| Variable            | Type     | Default                       | Description                                  |
| ------------------- | -------- | ----------------------------- | -------------------------------------------- |
| `GROQ_API_KEY`      | `string` | **required**                  | Groq API key used for AI generation          |
| `FIRECRAWL_API_KEY` | `string` | **required for URL Analysis** | Firecrawl API key used for website retrieval |
| `HTTP_PROXY`        | `string` | `""`                          | Corporate proxy URL when required            |
| `HTTPS_PROXY`       | `string` | `""`                          | HTTPS proxy URL when required                |

### Database Schema

SQLite is automatically initialised when the backend starts.

The database stores application information including:

| Table              | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `sessions`         | Interview sessions, conversation history, topics and session information |
| `knowledge_chunks` | Extracted knowledge, domains, confidence scores and related information  |
| `uploaded_files`   | Uploaded document metadata and extracted content                         |
| `resources`        | Entries from the resource management pages                               |

---

## 📖 Usage Examples

### Start a Text Interview

1. Open `http://localhost:5173`
2. Click **Text Agent** in the sidebar
3. Select **🎤 Interview Mode**
4. Enter your name
5. Click **Start Session**
6. Alex begins asking structured questions about your role

---

### Query the Knowledge Base

1. Open **Text Agent**
2. Switch to **🔍 Ask Alex**
3. Enter a question in natural language:

```text
What topics were covered during the interview?

What processes were discussed?

Tell me about the information contained in the uploaded document.
```

Alex searches available knowledge and document context and generates an answer.

---

### Upload a Document

Open:

```text
Upload Files
```

and upload a supported document.

Supported formats include:

```text
.pdf
.docx
.doc
.png
.jpg
.webp
```

The uploaded content can then be used as context by the relevant AI features.

---

### Analyze a Website URL

Open:

```text
Upload URL
```

Enter a publicly accessible website:

```text
https://www.python.org/
```

Then enter a question such as:

```text
What is Python and what is it mainly used for?
```

Helix retrieves the website using Firecrawl, processes the content, retrieves relevant source chunks, and generates an answer using Groq.

Follow-up questions can then be asked about the same website.

Example:

```text
What resources does the website provide for beginners?

What documentation is available?

What is the role of the Python Software Foundation?

Can you explain that in more detail?
```

---

### Analyze a PDF

Open:

```text
Upload PDF
```

Upload a PDF document and ask questions such as:

```text
What is the main purpose of this document?

What are the key points discussed?

Summarize the main process described in the document.

What are the important technical components?

What recommendations are provided?
```

Follow-up questions can continue naturally:

```text
Can you explain the second point?

Why is that important?

What does the document say about the next step?
```

---

### Add a Resource Entry

1. Click a resource page such as **Jira**
2. Click **Add Resource**
3. Fill in Title, URL, Description and Tags
4. Click **Create**
5. The resource appears in the resource list

---

## 🔍 URL Analysis Example

Example website:

```text
https://www.python.org/
```

Example questions:

```text
What is Python and what is it mainly used for?

What resources does the website provide for beginners?

What documentation is available?

What is the role of the Python Software Foundation?
```

Follow-up:

```text
Which resource should a beginner start with?

What exactly does that organisation do?

Can you explain the previous answer in more detail?
```

---

## 📕 PDF Analysis Example

After uploading a PDF:

```text
What is the main purpose of this document?

What are the most important findings?

What processes are described?

What are the major technical components?
```

Follow-up:

```text
Can you explain the second point?

Why is that important?

What does the document recommend?
```

---

## 🧪 Verify Everything is Working

### Backend Health Check

Open:

```text
http://localhost:8000/api/health
```

### Groq API Connectivity

Open:

```text
http://localhost:8000/api/test/groq
```

### Document Context Check

Open:

```text
http://localhost:8000/api/test/context
```

### API Documentation

FastAPI automatically provides interactive API documentation at:

```text
http://localhost:8000/docs
```

---

## 🔧 Troubleshooting

### Backend does not start

Confirm that:

```text
1. The virtual environment is activated.
2. Dependencies are installed.
3. backend/.env exists.
4. GROQ_API_KEY is configured.
5. FIRECRAWL_API_KEY is configured for URL analysis.
6. Required proxy environment variables are configured when working behind the Bosch corporate network.
```

### URL analysis fails

Check:

```text
1. The URL is publicly accessible.
2. FIRECRAWL_API_KEY is configured.
3. The corporate proxy is active when required.
4. Firecrawl retrieval completes successfully.
5. The backend is running on port 8000.
```

### PDF analysis fails

Check:

```text
1. The uploaded file is a valid PDF.
2. PyMuPDF is installed through requirements.txt.
3. The backend is running.
4. The PDF contains extractable text where applicable.
5. GROQ_API_KEY is configured.
```

### Frontend cannot connect to backend

Confirm that both applications are running:

```text
Frontend → http://localhost:5173
Backend  → http://127.0.0.1:8000
```

Also confirm that `vite.config.js` is forwarding `/api` requests to the backend.

---

## 🚀 Current Capabilities

Helix AI currently provides:

```text
🎤 Voice Agent
💬 Text Agent
📄 Document Context
🌐 Upload URL Analysis
📕 Upload PDF Analysis
🧠 Knowledge Extraction
🔍 Ask Alex
📊 Knowledge Hub
🔗 Resource Management
💾 SQLite Persistence
💬 Follow-up Conversations
```

### URL Analysis Technology

```text
Website
   ↓
Firecrawl
   ↓
Markdown
   ↓
Content Cleaner
   ↓
Chunking Service
   ↓
Local RAG
   ↓
Context Builder
   ↓
Groq
   ↓
Answer
```

### PDF Analysis Technology

```text
PDF
   ↓
PyMuPDF
   ↓
PDF Extraction
   ↓
Context Preparation
   ↓
Groq
   ↓
Answer
   ↓
Follow-up Conversation
   ↓
Persistence
```

---

**Suggested future enhancements:**

* PostgreSQL migration for production deployments
* Multi-language interview support
* Export knowledge base to Excel / PDF report
* Authentication and user roles
* Advanced semantic/vector retrieval
* Production deployment and monitoring
