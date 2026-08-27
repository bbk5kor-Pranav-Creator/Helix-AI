"""
text_chat.py — Text agent + Ask Alex query routes
"""
import os
import re
from fastapi import APIRouter
from pydantic import BaseModel
from database import db_get_all_knowledge, db_get_all_extracted_texts

router = APIRouter()


class QueryBody(BaseModel):
    question: str


def get_document_context() -> str:
    texts = db_get_all_extracted_texts()
    if not texts:
        return ""
    parts = []
    for t in texts:
        if t.get("extracted_text"):
            parts.append(f"[Document: {t['original_name']}]\n{t['extracted_text'][:2000]}")
    return "\n\n".join(parts)


@router.post("/query")
def query_knowledge(body: QueryBody):
    """Ask Alex a question — searches knowledge base + uploaded documents."""
    import httpx
    from groq import Groq

    proxy_url    = os.getenv("HTTP_PROXY")
    client_params = {"api_key": os.getenv("GROQ_API_KEY")}
    if proxy_url:
        client_params["http_client"] = httpx.Client(
            proxies={"http://": proxy_url, "https://": proxy_url}
        )
    client = Groq(**client_params)

    knowledge    = db_get_all_knowledge(min_confidence=0.0)
    doc_context  = get_document_context()

    knowledge_text = ""
    if knowledge:
        for c in knowledge[:60]:
            knowledge_text += f"- [{c['employee_name']} on {(c['extracted_at'] or '')[:10]}] {c['topic']}: {c['content']}\n"

    system_prompt = (
        "You are Alex, the Bosch Knowledge Assistant. "
        "Answer questions using the knowledge base and uploaded documents provided. "
        "Always mention who shared the information and when. Be specific and helpful."
    )

    user_prompt = ""
    if knowledge_text:
        user_prompt += f"KNOWLEDGE BASE:\n{knowledge_text}\n\n"
    if doc_context:
        user_prompt += f"UPLOADED DOCUMENTS:\n{doc_context}\n\n"
    user_prompt += f"QUESTION: {body.question}"

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=600,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        return {"answer": f"Sorry, I encountered an error: {e}"}


@router.get("/sessions")
def get_sessions():
    from database import db_get_all_sessions
    return db_get_all_sessions()


@router.get("/knowledge")
def get_knowledge():
    return db_get_all_knowledge(min_confidence=0.0)
