"""
voice.py — Voice/Text agent session routes with file context injection
"""
import os, json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from database import db

router = APIRouter()

# ── Import Groq client from parent project ──
from groq import Groq
from dotenv import load_dotenv
load_dotenv()

_api_key = os.getenv("GROQ_API_KEY")
if not _api_key:
    print("[ERROR] GROQ_API_KEY not found in environment! Check your .env file.")
else:
    print(f"[OK] GROQ_API_KEY loaded (starts with: {_api_key[:8]}...)")

# Force proxy at OS level so all HTTP libraries pick it up automatically
_proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY") or os.getenv("http_proxy") or "http://127.0.0.1:3128"
os.environ["HTTP_PROXY"]  = _proxy
os.environ["HTTPS_PROXY"] = _proxy
os.environ["http_proxy"]  = _proxy
os.environ["https_proxy"] = _proxy
print(f"[OK] Proxy set to: {_proxy}")

groq_client = Groq(api_key=_api_key)

from pathlib import Path
CONV_PROMPT = Path("prompts/conversation.txt").read_text(encoding="utf-8") if Path("prompts/conversation.txt").exists() else ""
EXTR_PROMPT = Path("prompts/extraction.txt").read_text(encoding="utf-8")  if Path("prompts/extraction.txt").exists() else ""

DEFAULT_TOPICS = [
    "Primary daily and weekly workflows",
    "Key supplier or partner relationships",
    "Systems and tools you are the internal expert on",
    "Common problems you solve that others commonly face",
    "Critical contacts outside your immediate team",
    "Processes you invented or significantly improved",
    "Things you know from experience not written anywhere",
]

OPENING_MESSAGE = (
    "Hi! I'm Alex, the Helix AI Knowledge Agent. "
    "I'm here to learn about your expertise so future colleagues "
    "can benefit from what you know. There are no wrong answers — just a friendly conversation. "
    "To start: what does a typical week in your current role look like?"
)

class StartBody(BaseModel):
    user_id:   str
    user_name: str

class TurnBody(BaseModel):
    user_id:   str
    user_name: str
    message:   str

def get_file_context() -> str:
    """Fetch all uploaded file texts to inject into LLM context."""
    try:
        with db() as conn:
            rows = conn.execute("SELECT original_name, extracted_text FROM uploaded_files WHERE text_extracted=1").fetchall()
        if not rows:
            return ""
        parts = []
        for r in rows:
            if r["extracted_text"]:
                parts.append(f"[Document: {r['original_name']}]\n{r['extracted_text'][:2000]}")
        return "\n\n---\n\n".join(parts)
    except Exception:
        return ""

def get_resource_context() -> str:
    """Fetch all resource entries to inject as context."""
    try:
        with db() as conn:
            rows = conn.execute("SELECT resource_key, title, description, link FROM resources ORDER BY resource_key").fetchall()
        if not rows:
            return ""
        by_key = {}
        for r in rows:
            by_key.setdefault(r["resource_key"], []).append(f"  - {r['title']}: {r['description'] or ''}")
        lines = ["[Available Resources]"]
        for key, items in by_key.items():
            lines.append(f"{key.upper()}:")
            lines.extend(items)
        return "\n".join(lines)
    except Exception:
        return ""

def load_session(user_id: str) -> dict | None:
    with db() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE user_id=?", (user_id,)).fetchone()
    if not row:
        return None
    s = dict(row)
    s["conversation_history"] = json.loads(s.get("conversation", "[]"))
    s["topics_covered"]       = json.loads(s.get("topics_covered", "[]"))
    s["topics_to_cover"]      = DEFAULT_TOPICS
    return s

def save_session(user_id: str, user_name: str, history: list, topics_covered: list, chunks: int, status: str = "active"):
    with db() as conn:
        conn.execute("""
            INSERT INTO sessions (user_id, user_name, conversation, topics_covered, chunks_extracted, status)
            VALUES (?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              conversation=excluded.conversation,
              topics_covered=excluded.topics_covered,
              chunks_extracted=excluded.chunks_extracted,
              status=excluded.status,
              last_active=datetime('now')
        """, (user_id, user_name, json.dumps(history), json.dumps(topics_covered), chunks, status))

def extract_chunks(text: str) -> list:
    if not EXTR_PROMPT or len(text.strip()) < 10:
        return []
    try:
        import re
        prompt = EXTR_PROMPT.format(turn_text=text)
        res = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant", max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = re.sub(r"```(?:json)?", "", res.choices[0].message.content.strip()).strip().rstrip("```").strip()
        chunks = json.loads(raw)
        return [c for c in chunks if isinstance(c, dict) and c.get("content", "").strip() and float(c.get("confidence", 0)) >= 0.3]
    except Exception as e:
        print(f"[EXTRACTION ERROR] {e}")
        return []

def save_chunks(user_id: str, user_name: str, chunks: list) -> int:
    if not chunks:
        return 0
    with db() as conn:
        for c in chunks:
            conn.execute("""
                INSERT INTO knowledge_chunks (user_id, employee_name, topic, domain, content, confidence, linked_person, linked_system, requires_followup)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (user_id, user_name, c.get("topic"), c.get("domain"), c.get("content"),
                  float(c.get("confidence", 0.5)), c.get("linked_person"), c.get("linked_system"),
                  1 if c.get("requires_followup") else 0))
    return len(chunks)

def get_next_message(session: dict, file_context: str, resource_context: str) -> dict:
    history          = session.get("conversation_history", [])
    topics_remaining = [t for t in DEFAULT_TOPICS if t not in session.get("topics_covered", [])]
    topics_covered   = session.get("topics_covered", [])

    history_text = ""
    for msg in history[-16:]:
        role = "Employee" if msg["role"] == "user" else "Alex"
        history_text += f"{role}: {msg['content']}\n"

    latest = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")

    # Build document + resource context block — injected BEFORE conversation history
    context_block = ""
    if file_context:
        context_block += f"""
═══════════════════════════════════════════════════════════
UPLOADED DOCUMENTS — USE THESE TO ASK SPECIFIC QUESTIONS
═══════════════════════════════════════════════════════════
The employee has uploaded the following documents. You MUST:
- Reference specific systems, tools, projects, or challenges mentioned in these documents
- Ask questions that probe the gap between what is documented and what the employee actually does
- Ask about specific items mentioned: technologies, processes, roles, challenges, status items
- Do NOT ask generic questions — ask questions only someone who read these documents would ask

{file_context[:4000]}
═══════════════════════════════════════════════════════════
"""
    if resource_context:
        context_block += f"""
AVAILABLE ENTERPRISE RESOURCES (reference these in questions):
{resource_context[:1000]}
"""

    from datetime import datetime
    today_name = datetime.now().strftime("%A")   # e.g. "Monday"
    tomorrow_name = (datetime.now() + __import__("datetime").timedelta(days=1)).strftime("%A")

    if CONV_PROMPT:
        # Inject context block into the prompt BEFORE the conversation history section
        base_prompt = CONV_PROMPT.format(
            topics_remaining="\n".join(f"- {t}" for t in topics_remaining) or "None — all covered",
            topics_covered="\n".join(f"- {t}" for t in topics_covered) or "None yet",
            followup_count=0,
            conversation_history=history_text or "No messages yet.",
            latest_message=latest or "(no message yet)",
            today_name=today_name,
        )
        # Replace hardcoded day references with actual current day
        base_prompt = base_prompt.replace("typical Tuesday", f"typical {today_name}")
        base_prompt = base_prompt.replace("a Tuesday", f"a {today_name}")
        base_prompt = base_prompt.replace("on Tuesday", f"on {today_name}")
        # Insert context block right before PREVIOUS CONVERSATION CONTEXT section
        if "PREVIOUS CONVERSATION CONTEXT" in base_prompt:
            prompt = base_prompt.replace(
                "PREVIOUS CONVERSATION CONTEXT",
                context_block + "\nPREVIOUS CONVERSATION CONTEXT"
            )
        else:
            prompt = context_block + base_prompt
    else:
        prompt = f"""You are Alex, a professional Helix AI knowledge capture agent.
{context_block}
Topics remaining: {topics_remaining}
Latest employee message: {latest}

Based on the uploaded documents above, ask a SPECIFIC question about something mentioned in those documents.
Respond with JSON only: {{"action":"FOLLOW_UP","message":"your specific question","topic_complete":false,"current_topic":"topic name"}}"""

    try:
        import re
        res = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = re.sub(r"```(?:json)?", "", res.choices[0].message.content.strip()).strip().rstrip("```").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"[CONVERSATION ERROR] {e}")
        return {"action": "FOLLOW_UP", "message": "That's interesting — could you tell me more?", "topic_complete": False, "current_topic": "general"}


@router.get("/test/context")
def test_context():
    """Show exactly what file context Alex is seeing."""
    file_ctx = get_file_context()
    resource_ctx = get_resource_context()
    from database import db as _db
    with _db() as conn:
        files = conn.execute("SELECT id, original_name, file_type, file_size, text_extracted, page_count, substr(extracted_text,1,200) as preview FROM uploaded_files").fetchall()
    return {
        "file_context_length": len(file_ctx),
        "file_context_preview": file_ctx[:500] if file_ctx else "EMPTY — no text extracted",
        "resource_context_length": len(resource_ctx),
        "uploaded_files": [dict(f) for f in files]
    }

@router.get("/test/groq")
def test_groq():
    """Quick test to verify Groq API is working."""
    try:
        key = os.getenv("GROQ_API_KEY")
        if not key:
            return {"status": "error", "message": "GROQ_API_KEY not set in .env"}
        res = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=50,
            messages=[{"role": "user", "content": "Say hello in one sentence."}]
        )
        return {"status": "ok", "response": res.choices[0].message.content, "key_prefix": key[:8]}
    except Exception as e:
        return {"status": "error", "message": str(e), "type": type(e).__name__}


@router.post("/query")
def query_knowledge(body: dict):
    """
    Answer a question using:
    1. Uploaded document content (PDFs, Word files)
    2. Captured knowledge chunks from interviews
    Falls back to keyword search if Groq unavailable.
    """
    question = body.get("question", "").strip()
    if not question:
        return {"answer": "Please ask a question."}

    # Load uploaded file context
    file_ctx = get_file_context()

    # Load knowledge chunks
    with db() as conn:
        rows = conn.execute(
            "SELECT employee_name, topic, domain, content, extracted_at FROM knowledge_chunks ORDER BY extracted_at DESC"
        ).fetchall()
    knowledge_text = ""
    if rows:
        knowledge_text = "\n\nCAPTURED INTERVIEW KNOWLEDGE:\n"
        for r in rows:
            knowledge_text += f"- [{r['topic']} | {r['domain']}] {r['content']} (from: {r['employee_name']}, date: {(r['extracted_at'] or '')[:10]})\n"

    # Build context
    context = ""
    if file_ctx:
        context += f"UPLOADED DOCUMENTS:\n{file_ctx[:5000]}\n"
    if knowledge_text:
        context += knowledge_text[:3000]

    if not context.strip():
        return {"answer": "I don't have any documents or knowledge captured yet. Upload a document or complete an interview session first, then ask me questions."}

    system_prompt = """You are Alex, the Helix AI Knowledge Agent. Answer the user's question based ONLY on the provided context below.

Rules:
- If the answer is in the uploaded documents, answer from there with specific details
- If the answer is in the interview knowledge, answer from there mentioning who said it
- If the topic is not covered in the context at all, say clearly: "I don't have information about that in my knowledge base."
- Be specific, professional, and concise
- Always cite your source: "According to the uploaded document..." or "Based on what [name] shared..."
- Never make up information not in the context"""

    user_prompt = f"""CONTEXT:
{context}

QUESTION: {question}

Answer based only on the context above."""

    try:
        res = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=800,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt}
            ]
        )
        return {"answer": res.choices[0].message.content}
    except Exception as e:
        print(f"[QUERY ERROR] {e}")
        # Fallback: keyword search
        if rows:
            kw = [w for w in question.lower().split() if len(w) > 3]
            matches = [r for r in rows if any(k in (r["content"] or "").lower() or k in (r["topic"] or "").lower() for k in kw)]
            if matches:
                lines = [f"• [{r['topic']}] {r['content']} (from: {r['employee_name']})" for r in matches[:5]]
                return {"answer": "\n".join(lines)}
        return {"answer": "Could not connect to AI. Please check your Groq API connection."}

@router.post("/voice/start")
def voice_start(body: StartBody):
    session = load_session(body.user_id)
    if not session:
        save_session(body.user_id, body.user_name, [{"role": "assistant", "content": OPENING_MESSAGE}], [], 0)
    return {"message": OPENING_MESSAGE, "session_id": body.user_id, "status": "started"}

@router.post("/voice/turn")
def voice_turn(body: TurnBody):
    session = load_session(body.user_id)
    if not session:
        save_session(body.user_id, body.user_name, [], [], 0)
        session = load_session(body.user_id)

    if session.get("status") == "completed":
        return {"message": "Your session is already complete. Thank you!", "session_complete": True, "chunks_extracted": session.get("chunks_extracted", 0), "topics_covered": len(session.get("topics_covered", []))}

    history = session.get("conversation_history", [])
    history.append({"role": "user", "content": body.message})

    # Extract knowledge
    chunks = extract_chunks(body.message)
    chunks_saved = save_chunks(body.user_id, body.user_name, chunks)
    total_chunks = (session.get("chunks_extracted") or 0) + chunks_saved

    # Get file + resource context
    file_ctx     = get_file_context()
    resource_ctx = get_resource_context()
    print(f"[CONTEXT] File context length: {len(file_ctx)} chars, Resource context: {len(resource_ctx)} chars")

    # Get next question
    session["conversation_history"] = history
    decision = get_next_message(session, file_ctx, resource_ctx)

    action    = decision.get("action", "FOLLOW_UP")
    reply     = decision.get("message", "Could you tell me more about that?")
    t_done    = decision.get("topic_complete", False)
    t_current = decision.get("current_topic", "")
    topics_covered = session.get("topics_covered", [])

    if t_done and t_current and t_current not in topics_covered:
        topics_covered.append(t_current)

    session_complete = False
    if action == "CLOSE":
        first = body.user_name.split()[0]
        reply = f"Thank you so much, {first}! I've captured {total_chunks} knowledge items. Your expertise will help future colleagues!"
        session_complete = True
        save_session(body.user_id, body.user_name, history + [{"role": "assistant", "content": reply}], topics_covered, total_chunks, "completed")
    else:
        history.append({"role": "assistant", "content": reply})
        save_session(body.user_id, body.user_name, history, topics_covered, total_chunks)

    return {"message": reply, "action": action, "session_complete": session_complete, "chunks_extracted": total_chunks, "topics_covered": len(topics_covered)}
