"""Helix AI website analysis router."""

import json
import os
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel
from firecrawl import Firecrawl
from groq import Groq

from database import db
from services.content_cleaner import clean_markdown
from services.chunking_service import chunk_markdown
from services.rag_service import retrieve_relevant_chunks
from services.answer_generator import generate_answer
from services.context_builder import build_rag_context


# =========================================================
# Environment
# =========================================================

load_dotenv()


# =========================================================
# Router
# =========================================================

router = APIRouter()


# =========================================================
# Configuration
# =========================================================

FIRECRAWL_API_KEY = os.getenv(
    "FIRECRAWL_API_KEY"
)

GROQ_API_KEY = os.getenv(
    "GROQ_API_KEY"
)

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

GROQ_MAX_OUTPUT_TOKENS = int(
    os.getenv(
        "GROQ_MAX_OUTPUT_TOKENS",
        "1200"
    )
)

GROQ_TEMPERATURE = float(
    os.getenv(
        "GROQ_TEMPERATURE",
        "0.2"
    )
)

RAG_TOP_K = int(
    os.getenv(
        "RAG_TOP_K",
        "5"
    )
)


# =========================================================
# Configuration Validation
# =========================================================

if not FIRECRAWL_API_KEY:
    raise RuntimeError(
        "FIRECRAWL_API_KEY is not configured in backend/.env"
    )


if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is not configured in backend/.env"
    )


# =========================================================
# External Clients
# =========================================================

firecrawl = Firecrawl(
    api_key=FIRECRAWL_API_KEY
)

groq_client = Groq(
    api_key=GROQ_API_KEY
)


print(
    "[GROQ] Client initialized."
)

print(
    "[GROQ] Model:",
    GROQ_MODEL
)


# =========================================================
# Request Model
# =========================================================

class URLRequest(BaseModel):
    url: str
    instruction: str = ""


class ConversationStartRequest(BaseModel):
    source_type: str = "website"
    source: str
    title: str = ""
    instruction: str = ""
    analysis_id: Optional[int] = None


class ConversationMessageRequest(BaseModel):
    session_id: int
    question: str


# =========================================================
# URL Validation
# =========================================================

def validate_url(url: str) -> str:
    """
    Validate and normalize a website URL.
    """

    url = (
        url or ""
    ).strip()

    if not url:
        raise ValueError(
            "Please enter a website URL."
        )

    if not url.lower().startswith(
        (
            "http://",
            "https://"
        )
    ):
        url = (
            "https://"
            + url
        )

    parsed = urlparse(
        url
    )

    if (
        parsed.scheme
        not in (
            "http",
            "https"
        )
        or not parsed.hostname
    ):
        raise ValueError(
            "Please enter a valid website URL."
        )

    return url


# =========================================================
# Firecrawl Retrieval
# =========================================================

def fetch_with_firecrawl(
    url: str
) -> dict:
    """
    Fetch website content from Firecrawl as Markdown.
    """

    print(
        "\n"
        + "=" * 60
    )

    print(
        "FIRECRAWL RETRIEVAL"
    )

    print(
        "=" * 60
    )

    print(
        "URL:",
        url
    )

    try:
        result = firecrawl.scrape(
            url,
            formats=[
                "markdown"
            ]
        )

    except Exception as exc:

        print(
            "Firecrawl request failed:",
            str(exc)
        )

        raise RuntimeError(
            "Firecrawl request failed: "
            + str(exc)
        )

    markdown = getattr(
        result,
        "markdown",
        None
    )

    if (
        not markdown
        or not str(markdown).strip()
    ):
        raise RuntimeError(
            "Firecrawl returned no usable Markdown content."
        )

    metadata = getattr(
        result,
        "metadata",
        None
    )

    title = ""

    if metadata:

        title = getattr(
            metadata,
            "title",
            ""
        ) or ""

    markdown = str(
        markdown
    ).strip()

    title = str(
        title
    ).strip()

    print(
        "Firecrawl retrieval successful."
    )

    print(
        "Page title:",
        title or "(no title)"
    )

    print(
        "Markdown characters:",
        len(markdown)
    )

    print(
        "=" * 60
    )

    return {
        "title": title,
        "markdown": markdown
    }


# =========================================================
# Database
# =========================================================

def save_resource(
    url: str,
    summary: str
):
    """
    Save the final website analysis.
    """

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    try:

        with db() as conn:

            conn.execute(
                """
                INSERT INTO resources
                (
                    resource_key,
                    title,
                    link,
                    description,
                    tags,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "website",
                    url,
                    url,
                    summary,
                    "website,ai-summary",
                    created_at
                )
            )

    except Exception as exc:

        print(
            "Database save error:",
            str(exc)
        )


def save_url_analysis(
    url: str,
    title: str,
    instruction: str,
    answer: str,
    chunks: list,
    chunks_used: int
):
    """
    Save a full analysis record, including chunks, so History and
    follow-up conversation can reuse it without calling Firecrawl again.
    """

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    try:

        with db() as conn:

            cursor = conn.execute(
                """
                INSERT INTO url_analyses
                (
                    url,
                    title,
                    instruction,
                    answer,
                    chunks_json,
                    chunks_used,
                    model,
                    extraction_method,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    url,
                    title,
                    instruction,
                    answer,
                    json.dumps(chunks),
                    chunks_used,
                    GROQ_MODEL,
                    "firecrawl",
                    created_at
                )
            )

            return cursor.lastrowid

    except Exception as exc:

        print(
            "Database save error (url_analyses):",
            str(exc)
        )

        return None


# =========================================================
# Analyze URL
# =========================================================

@router.post(
    "/analyze-url"
)
def analyze_url(
    request: URLRequest
):
    """
    Run the Helix Upload URL analysis engine.

    Pipeline:

        URL
          ↓
        Firecrawl
          ↓
        WebLens-style cleaning
          ↓
        Markdown chunking
          ↓
        WebLens-style relevance retrieval
          ↓
        Grounded answer generation
          ↓
        Database
          ↓
        API response
    """

    try:

        # -------------------------------------------------
        # Validate URL
        # -------------------------------------------------

        url = validate_url(
            request.url
        )

        # -------------------------------------------------
        # Validate instruction
        # -------------------------------------------------

        instruction = (
            request.instruction or ""
        ).strip()

        print(
            "\n"
            + "=" * 60
        )

        print(
            "HELIX AI — ANALYZE URL"
        )

        print(
            "=" * 60
        )

        print(
            "URL:",
            url
        )

        print(
            "Instruction:",
            instruction
        )

        print(
            "=" * 60
        )

        if not instruction:

            return {
                "success": False,
                "url": url,
                "message": (
                    "Please provide a question or instruction "
                    "about the website."
                )
            }

        # -------------------------------------------------
        # Firecrawl
        # -------------------------------------------------

        scraped = fetch_with_firecrawl(
            url
        )

        # -------------------------------------------------
        # WebLens-style cleaning
        # -------------------------------------------------

        cleaned_markdown = clean_markdown(
            scraped["markdown"]
        )

        if not cleaned_markdown:

            return {
                "success": False,
                "url": url,
                "title": scraped["title"],
                "message": (
                    "Firecrawl retrieved the website, but no "
                    "usable content remained after cleaning."
                )
            }

        print(
            "Cleaned Markdown characters:",
            len(cleaned_markdown)
        )

        # -------------------------------------------------
        # Chunking
        # -------------------------------------------------

        chunks = chunk_markdown(
            markdown=cleaned_markdown,
            source_url=url,
            title=scraped["title"]
        )

        print(
            "Chunks created:",
            len(chunks)
        )

        if not chunks:

            return {
                "success": False,
                "url": url,
                "title": scraped["title"],
                "message": (
                    "Firecrawl retrieved the website, but no "
                    "usable content chunks could be created."
                )
            }

        # -------------------------------------------------
        # RAG Retrieval
        # -------------------------------------------------

        relevant_chunks = (
            retrieve_relevant_chunks(
                chunks=chunks,
                question=instruction,
                top_k=RAG_TOP_K
            )
        )

        print(
            "Relevant chunks:",
            len(relevant_chunks)
        )

        if not relevant_chunks:

            return {
                "success": False,
                "url": url,
                "title": scraped["title"],
                "chunk_count": len(chunks),
                "message": (
                    "The website was retrieved successfully, "
                    "but no relevant information was found "
                    "for the requested question."
                )
            }

        # -------------------------------------------------
        # Groq Answer Generation
        # -------------------------------------------------

        answer = generate_answer(
            question=instruction,
            source_url=url,
            page_title=scraped["title"],
            relevant_chunks=relevant_chunks
        )

        # -------------------------------------------------
        # Save Resource / Analysis History
        # -------------------------------------------------

        save_resource(
            url,
            answer
        )

        analysis_id = save_url_analysis(
            url=url,
            title=scraped["title"],
            instruction=instruction,
            answer=answer,
            chunks=chunks,
            chunks_used=len(relevant_chunks)
        )

        # -------------------------------------------------
        # Final Response
        # -------------------------------------------------

        return {
            "success": True,
            "analysis_id": analysis_id,
            "url": url,
            "source_url": url,
            "source_type": "website",
            "title": scraped["title"],
            "source_title": scraped["title"],
            "instruction": instruction,
            "content": cleaned_markdown,
            "chunk_count": len(chunks),
            "relevant_chunks": relevant_chunks,
            "relevant_chunk_count": len(
                relevant_chunks
            ),
            "chunks_used": len(relevant_chunks),
            "model": GROQ_MODEL,
            "extraction_method": "firecrawl",
            "message": answer,
            "answer": answer
        }

    # =====================================================
    # Validation Errors
    # =====================================================

    except ValueError as exc:

        print(
            "Validation error:",
            str(exc)
        )

        return {
            "success": False,
            "message": str(exc)
        }

    # =====================================================
    # General Errors
    # =====================================================

    except Exception as exc:

        print(
            "\nAnalyze URL error:",
            str(exc)
        )

        return {
            "success": False,
            "message": (
                "Helix AI could not process this website: "
                + str(exc)
            )
        }


# =========================================================
# Web Resources
# =========================================================

@router.get(
    "/web-resources"
)
def get_web_resources():
    """
    Return saved website resources.
    """

    try:

        with db() as conn:

            rows = conn.execute(
                """
                SELECT
                    id,
                    title,
                    link,
                    description,
                    tags,
                    created_at
                FROM resources
                WHERE resource_key = ?
                ORDER BY id DESC
                """,
                (
                    "website",
                )
            ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    except Exception as exc:

        return {
            "message": str(exc)
        }


# =========================================================
# Delete Web Resource
# =========================================================

@router.delete(
    "/web-resources/{resource_id}"
)
def delete_web_resource(
    resource_id: int
):
    """
    Delete a saved website resource.
    """

    try:

        with db() as conn:

            cursor = conn.execute(
                """
                DELETE FROM resources
                WHERE id = ?
                  AND resource_key = ?
                """,
                (
                    resource_id,
                    "website"
                )
            )

            if cursor.rowcount == 0:

                return {
                    "success": False,
                    "message": "Website not found."
                }

        return {
            "success": True,
            "message": "Website deleted successfully."
        }

    except Exception as exc:

        return {
            "success": False,
            "message": str(exc)
        }


# =========================================================
# Conversation — Start
# =========================================================

@router.post(
    "/conversation/start"
)
def start_conversation(
    request: ConversationStartRequest
):
    """
    Start a follow-up conversation session for an analyzed source.
    """

    try:

        source = (
            request.source or ""
        ).strip()

        if not source:
            raise ValueError(
                "A source is required to start a conversation."
            )

        with db() as conn:

            cursor = conn.execute(
                """
                INSERT INTO website_sessions
                (url, title, analysis_id)
                VALUES (?, ?, ?)
                """,
                (
                    source,
                    (request.title or "").strip(),
                    request.analysis_id
                )
            )

            session_id = cursor.lastrowid

        return {
            "success": True,
            "session_id": session_id
        }

    except ValueError as exc:

        return {
            "success": False,
            "error": str(exc)
        }

    except Exception as exc:

        print(
            "Conversation start error:",
            str(exc)
        )

        return {
            "success": False,
            "error": "Helix AI could not start the conversation."
        }


# =========================================================
# Conversation — Message
# =========================================================

@router.post(
    "/conversation/message"
)
def send_conversation_message(
    request: ConversationMessageRequest
):
    """
    Answer a follow-up question using the chunks captured at analysis
    time, without re-fetching or re-cleaning the source.
    """

    try:

        question = (
            request.question or ""
        ).strip()

        if not question:
            raise ValueError(
                "A question is required."
            )

        with db() as conn:

            session_row = conn.execute(
                """
                SELECT id, url, title, analysis_id
                FROM website_sessions
                WHERE id = ?
                """,
                (
                    request.session_id,
                )
            ).fetchone()

            if not session_row:
                raise ValueError(
                    "This conversation is no longer available."
                )

            analysis_row = conn.execute(
                """
                SELECT chunks_json
                FROM url_analyses
                WHERE id = ?
                """,
                (
                    session_row["analysis_id"],
                )
            ).fetchone()

            if (
                not analysis_row
                or not analysis_row["chunks_json"]
            ):
                raise ValueError(
                    "No source content is available for this conversation."
                )

            chunks = json.loads(
                analysis_row["chunks_json"]
            )

            relevant_chunks = retrieve_relevant_chunks(
                chunks=chunks,
                question=question,
                top_k=RAG_TOP_K
            )

            if not relevant_chunks:
                raise ValueError(
                    "No relevant information was found for that question."
                )

            answer = generate_answer(
                question=question,
                source_url=session_row["url"],
                page_title=session_row["title"],
                relevant_chunks=relevant_chunks
            )

            conn.execute(
                """
                INSERT INTO website_messages (session_id, role, message)
                VALUES (?, 'user', ?)
                """,
                (
                    request.session_id,
                    question
                )
            )

            conn.execute(
                """
                INSERT INTO website_messages (session_id, role, message)
                VALUES (?, 'assistant', ?)
                """,
                (
                    request.session_id,
                    answer
                )
            )

            conn.execute(
                """
                UPDATE website_sessions
                SET last_active = datetime('now')
                WHERE id = ?
                """,
                (
                    request.session_id,
                )
            )

            turns = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM website_messages
                WHERE session_id = ?
                """,
                (
                    request.session_id,
                )
            ).fetchone()["count"]

        return {
            "success": True,
            "answer": answer,
            "chunks_used": len(relevant_chunks),
            "conversation_turns": turns
        }

    except ValueError as exc:

        return {
            "success": False,
            "error": str(exc)
        }

    except Exception as exc:

        print(
            "Conversation message error:",
            str(exc)
        )

        return {
            "success": False,
            "error": "Helix AI was unable to answer that question right now."
        }


# =========================================================
# URL History — List
# =========================================================

@router.get(
    "/url-history"
)
def get_url_history(
    limit: int = 100
):
    """
    List saved URL analyses, most recent first.
    """

    try:

        with db() as conn:

            rows = conn.execute(
                """
                SELECT
                    id,
                    url,
                    title,
                    instruction,
                    answer,
                    chunks_used,
                    model,
                    extraction_method,
                    created_at
                FROM url_analyses
                ORDER BY id DESC
                LIMIT ?
                """,
                (
                    max(1, int(limit)),
                )
            ).fetchall()

        return {
            "success": True,
            "analyses": [
                dict(row)
                for row in rows
            ]
        }

    except Exception as exc:

        return {
            "success": False,
            "error": str(exc)
        }


# =========================================================
# URL History — Get One
# =========================================================

@router.get(
    "/url-history/{analysis_id}"
)
def get_url_history_item(
    analysis_id: int
):
    """
    Return one saved analysis plus its follow-up conversation, if any.
    """

    try:

        with db() as conn:

            analysis_row = conn.execute(
                """
                SELECT
                    id,
                    url,
                    title,
                    instruction,
                    answer,
                    chunks_used,
                    model,
                    extraction_method,
                    created_at
                FROM url_analyses
                WHERE id = ?
                """,
                (
                    analysis_id,
                )
            ).fetchone()

            if not analysis_row:

                return {
                    "success": False,
                    "error": "Analysis not found."
                }

            session_row = conn.execute(
                """
                SELECT id
                FROM website_sessions
                WHERE analysis_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (
                    analysis_id,
                )
            ).fetchone()

            conversation = None

            if session_row:

                message_rows = conn.execute(
                    """
                    SELECT role, message
                    FROM website_messages
                    WHERE session_id = ?
                    ORDER BY id ASC
                    """,
                    (
                        session_row["id"],
                    )
                ).fetchall()

                conversation = {
                    "session_id": session_row["id"],
                    "messages": [
                        {
                            "role": row["role"],
                            "content": row["message"]
                        }
                        for row in message_rows
                    ]
                }

        return {
            "success": True,
            "analysis": dict(analysis_row),
            "conversation": conversation
        }

    except Exception as exc:

        return {
            "success": False,
            "error": str(exc)
        }


# =========================================================
# URL History — Delete One
# =========================================================

@router.delete(
    "/url-history/{analysis_id}"
)
def delete_url_history_item(
    analysis_id: int
):
    """
    Delete one saved analysis and its follow-up conversation.
    """

    try:

        with db() as conn:

            session_row = conn.execute(
                """
                SELECT id
                FROM website_sessions
                WHERE analysis_id = ?
                """,
                (
                    analysis_id,
                )
            ).fetchone()

            if session_row:

                conn.execute(
                    """
                    DELETE FROM website_messages
                    WHERE session_id = ?
                    """,
                    (
                        session_row["id"],
                    )
                )

                conn.execute(
                    """
                    DELETE FROM website_sessions
                    WHERE id = ?
                    """,
                    (
                        session_row["id"],
                    )
                )

            cursor = conn.execute(
                """
                DELETE FROM url_analyses
                WHERE id = ?
                """,
                (
                    analysis_id,
                )
            )

            if cursor.rowcount == 0:

                return {
                    "success": False,
                    "error": "Analysis not found."
                }

        return {
            "success": True
        }

    except Exception as exc:

        return {
            "success": False,
            "error": str(exc)
        }


# =========================================================
# URL History — Clear All
# =========================================================

@router.delete(
    "/url-history"
)
def clear_url_history():
    """
    Delete all saved analyses and their follow-up conversations.
    """

    try:

        with db() as conn:

            conn.execute(
                "DELETE FROM website_messages"
            )

            conn.execute(
                "DELETE FROM website_sessions"
            )

            conn.execute(
                "DELETE FROM url_analyses"
            )

        return {
            "success": True
        }

    except Exception as exc:

        return {
            "success": False,
            "error": str(exc)
        }