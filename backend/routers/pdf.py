"""Helix AI PDF analysis router."""

import json
import os
import uuid
from datetime import datetime

from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, UploadFile

from database import db
from services.content_cleaner import clean_markdown
from services.chunking_service import chunk_markdown
from services.pdf_extractor import extract_pdf_content
from services.rag_service import retrieve_relevant_chunks
from services.answer_generator import generate_answer


load_dotenv()


router = APIRouter()


GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

RAG_TOP_K = int(
    os.getenv(
        "RAG_TOP_K",
        "5"
    )
)

MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024

TMP_PDF_DIR = os.path.join(
    "uploads",
    "tmp_pdf"
)

os.makedirs(
    TMP_PDF_DIR,
    exist_ok=True
)


def _is_pdf_upload(
    content_type: str,
    filename: str
) -> bool:
    """Detect a PDF upload by content-type, falling back to extension."""

    if (content_type or "").lower() == "application/pdf":
        return True

    return os.path.splitext(
        filename or ""
    )[1].lower() == ".pdf"


async def _save_upload_to_temp(
    file: UploadFile
) -> str:
    """
    Stream the upload to a UUID-named temp file, enforcing the size
    cap while writing. Caller is responsible for deleting the file.
    """

    temp_path = os.path.join(
        TMP_PDF_DIR,
        f"{uuid.uuid4().hex}.pdf"
    )

    total_bytes = 0
    chunk_size = 1024 * 1024

    with open(temp_path, "wb") as out_file:

        while True:

            chunk = await file.read(chunk_size)

            if not chunk:
                break

            total_bytes += len(chunk)

            if total_bytes > MAX_PDF_SIZE_BYTES:

                out_file.close()

                if os.path.exists(temp_path):
                    os.remove(temp_path)

                raise ValueError(
                    "The PDF exceeds the 20 MB upload limit."
                )

            out_file.write(chunk)

    if total_bytes == 0:

        os.remove(temp_path)

        raise ValueError(
            "The uploaded file is empty."
        )

    return temp_path


def save_pdf_analysis(
    filename: str,
    title: str,
    instruction: str,
    answer: str,
    chunks: list,
    chunks_used: int,
    page_count: int
):
    """Save a full PDF analysis record, including chunks, for history/follow-ups."""

    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    try:

        with db() as conn:

            cursor = conn.execute(
                """
                INSERT INTO pdf_analyses
                (
                    filename,
                    title,
                    instruction,
                    answer,
                    chunks_json,
                    chunks_used,
                    model,
                    extraction_method,
                    page_count,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    filename,
                    title,
                    instruction,
                    answer,
                    json.dumps(chunks),
                    chunks_used,
                    GROQ_MODEL,
                    "pymupdf",
                    page_count,
                    created_at
                )
            )

            return cursor.lastrowid

    except Exception as exc:

        print(
            "Database save error (pdf_analyses):",
            str(exc)
        )

        return None


# =========================================================
# Analyze PDF
# =========================================================

@router.post(
    "/analyze-pdf"
)
async def analyze_pdf(
    file: UploadFile = File(...),
    instruction: str = Form("")
):
    """
    Run the Helix PDF analysis engine.

    Pipeline:

        PDF (multipart upload)
          ↓
        Temp file (size-capped)
          ↓
        PyMuPDF extraction (text + tables, page-structured)
          ↓
        WebLens-style cleaning
          ↓
        Markdown chunking
          ↓
        Hybrid relevance retrieval
          ↓
        Grounded answer generation
          ↓
        Database
          ↓
        API response

    The temp file is always removed in the `finally` block.
    """

    temp_path = None

    try:

        filename = (file.filename or "document.pdf").strip()

        if not _is_pdf_upload(file.content_type, filename):

            return {
                "success": False,
                "message": "Please upload a PDF file."
            }

        instruction = (instruction or "").strip()

        print("\n" + "=" * 60)
        print("HELIX AI — ANALYZE PDF")
        print("=" * 60)
        print("Filename:", filename)
        print("Instruction:", instruction)
        print("=" * 60)

        if not instruction:

            return {
                "success": False,
                "filename": filename,
                "message": (
                    "Please provide a question or instruction "
                    "about the PDF."
                )
            }

        try:
            temp_path = await _save_upload_to_temp(file)
        except ValueError as exc:
            return {
                "success": False,
                "filename": filename,
                "message": str(exc)
            }

        try:
            extracted = extract_pdf_content(temp_path)
        except ValueError as exc:
            return {
                "success": False,
                "filename": filename,
                "message": str(exc)
            }

        cleaned_markdown = clean_markdown(extracted["markdown"])

        if not cleaned_markdown:

            return {
                "success": False,
                "filename": filename,
                "message": (
                    "This PDF was parsed, but no usable content "
                    "remained after cleaning."
                )
            }

        print("Cleaned Markdown characters:", len(cleaned_markdown))

        chunks = chunk_markdown(
            markdown=cleaned_markdown,
            source_url=filename,
            title=extracted["title"]
        )

        print("Chunks created:", len(chunks))

        if not chunks:

            return {
                "success": False,
                "filename": filename,
                "message": (
                    "This PDF was parsed, but no usable content "
                    "chunks could be created."
                )
            }

        relevant_chunks = retrieve_relevant_chunks(
            chunks=chunks,
            question=instruction,
            top_k=RAG_TOP_K
        )

        print("Relevant chunks:", len(relevant_chunks))

        if not relevant_chunks:

            return {
                "success": False,
                "filename": filename,
                "chunk_count": len(chunks),
                "message": (
                    "The PDF was parsed successfully, but no "
                    "relevant information was found for the "
                    "requested question."
                )
            }

        answer = generate_answer(
            question=instruction,
            source_url=filename,
            page_title=extracted["title"],
            relevant_chunks=relevant_chunks,
            source_type="pdf"
        )

        analysis_id = save_pdf_analysis(
            filename=filename,
            title=extracted["title"],
            instruction=instruction,
            answer=answer,
            chunks=chunks,
            chunks_used=len(relevant_chunks),
            page_count=extracted["page_count"]
        )

        return {
            "success": True,
            "analysis_id": analysis_id,
            "filename": filename,
            "source_url": filename,
            "source_type": "pdf",
            "title": extracted["title"],
            "source_title": extracted["title"],
            "instruction": instruction,
            "content": cleaned_markdown,
            "chunk_count": len(chunks),
            "page_count": extracted["page_count"],
            "relevant_chunks": relevant_chunks,
            "relevant_chunk_count": len(relevant_chunks),
            "chunks_used": len(relevant_chunks),
            "model": GROQ_MODEL,
            "extraction_method": "pymupdf",
            "message": answer,
            "answer": answer
        }

    except Exception as exc:

        print("\nAnalyze PDF error:", str(exc))

        return {
            "success": False,
            "message": "Helix AI could not process this PDF: " + str(exc)
        }

    finally:

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# =========================================================
# PDF History — List
# =========================================================

@router.get(
    "/pdf-history"
)
def get_pdf_history(
    limit: int = 100
):
    """List saved PDF analyses, most recent first."""

    try:

        with db() as conn:

            rows = conn.execute(
                """
                SELECT
                    id,
                    filename,
                    title,
                    instruction,
                    answer,
                    chunks_used,
                    model,
                    extraction_method,
                    page_count,
                    created_at
                FROM pdf_analyses
                ORDER BY id DESC
                LIMIT ?
                """,
                (
                    max(1, int(limit)),
                )
            ).fetchall()

        return {
            "success": True,
            "analyses": [dict(row) for row in rows]
        }

    except Exception as exc:

        return {
            "success": False,
            "error": str(exc)
        }


# =========================================================
# PDF History — Get One
# =========================================================

@router.get(
    "/pdf-history/{analysis_id}"
)
def get_pdf_history_item(
    analysis_id: int
):
    """Return one saved PDF analysis plus its follow-up conversation, if any."""

    try:

        with db() as conn:

            analysis_row = conn.execute(
                """
                SELECT
                    id,
                    filename,
                    title,
                    instruction,
                    answer,
                    chunks_used,
                    model,
                    extraction_method,
                    page_count,
                    created_at
                FROM pdf_analyses
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
                  AND source_type = 'pdf'
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
                        {"role": row["role"], "content": row["message"]}
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
# PDF History — Delete One
# =========================================================

@router.delete(
    "/pdf-history/{analysis_id}"
)
def delete_pdf_history_item(
    analysis_id: int
):
    """Delete one saved PDF analysis and its follow-up conversation."""

    try:

        with db() as conn:

            session_row = conn.execute(
                """
                SELECT id
                FROM website_sessions
                WHERE analysis_id = ?
                  AND source_type = 'pdf'
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
                DELETE FROM pdf_analyses
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
# PDF History — Clear All
# =========================================================

@router.delete(
    "/pdf-history"
)
def clear_pdf_history():
    """Delete all saved PDF analyses and their follow-up conversations."""

    try:

        with db() as conn:

            conn.execute(
                """
                DELETE FROM website_messages
                WHERE session_id IN (
                    SELECT id FROM website_sessions WHERE source_type = 'pdf'
                )
                """
            )

            conn.execute(
                "DELETE FROM website_sessions WHERE source_type = 'pdf'"
            )

            conn.execute(
                "DELETE FROM pdf_analyses"
            )

        return {
            "success": True
        }

    except Exception as exc:

        return {
            "success": False,
            "error": str(exc)
        }
