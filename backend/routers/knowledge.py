"""
knowledge.py — Knowledge base query and stats routes
"""
import json

from fastapi import APIRouter
from pydantic import BaseModel
from database import db
from collections import defaultdict
from services.knowledge_intelligence_service import extract_knowledge

router = APIRouter()

def row_to_dict(row):
    d = dict(row)
    d["requires_followup"] = bool(d.get("requires_followup"))
    d["validated"]         = bool(d.get("validated"))
    return d

@router.get("/knowledge")
def get_knowledge(min_confidence: float = 0.0):
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM knowledge_chunks WHERE confidence >= ? ORDER BY extracted_at DESC",
            (min_confidence,)
        ).fetchall()
    return [row_to_dict(r) for r in rows]

@router.get("/sessions")
def get_sessions():
    import json
    with db() as conn:
        rows = conn.execute("SELECT * FROM sessions ORDER BY last_active DESC").fetchall()
    result = []
    for r in rows:
        s = dict(r)
        s["conversation_history"] = json.loads(s.pop("conversation", "[]"))
        s["topics_covered"]       = json.loads(s.get("topics_covered", "[]"))
        result.append(s)
    return result

@router.get("/stats")
def get_stats():
    with db() as conn:
        total_sessions = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        total_chunks   = conn.execute("SELECT COUNT(*) FROM knowledge_chunks").fetchone()[0]
        domains        = [r[0] for r in conn.execute("SELECT DISTINCT domain FROM knowledge_chunks WHERE domain IS NOT NULL").fetchall()]
        sessions       = conn.execute("SELECT user_name, status, chunks_extracted FROM sessions").fetchall()
    return {
        "total_sessions": total_sessions,
        "total_chunks":   total_chunks,
        "domains":        domains,
        "sessions": [{"user_name": s["user_name"], "status": s["status"], "chunks_extracted": s["chunks_extracted"]} for s in sessions]
    }

@router.get("/summary/overview")
def summary_overview():
    with db() as conn:
        chunks  = conn.execute("SELECT * FROM knowledge_chunks").fetchall()
        sessions= conn.execute("SELECT * FROM sessions").fetchall()
    if not chunks:
        return {"total_items": 0, "total_employees": 0, "total_topics": 0, "total_domains": 0, "active_days": 0, "employees": [], "domains": []}

    employees  = sorted({c["employee_name"] for c in chunks if c["employee_name"]})
    topics     = {c["topic"] for c in chunks if c["topic"]}
    domains    = sorted({c["domain"] for c in chunks if c["domain"]})
    days       = sorted({(c["extracted_at"] or "")[:10] for c in chunks if c["extracted_at"]})
    return {
        "total_items":     len(chunks),
        "total_employees": len(employees),
        "total_topics":    len(topics),
        "total_domains":   len(domains),
        "active_days":     len(days),
        "employees":       employees,
        "domains":         domains,
        "latest_date":     days[-1] if days else None,
    }


# =========================================================
# Knowledge Intelligence
# =========================================================

class KnowledgeIntelligenceRequest(BaseModel):
    source_type: str = "website"
    analysis_id: int
    force_refresh: bool = False


def _get_analysis_source(conn, source_type: str, analysis_id: int):
    """Look up a saved analysis row from url_analyses or pdf_analyses."""

    if source_type == "pdf":
        row = conn.execute(
            """
            SELECT id, filename AS ref, title, chunks_json
            FROM pdf_analyses
            WHERE id = ?
            """,
            (analysis_id,)
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT id, url AS ref, title, chunks_json
            FROM url_analyses
            WHERE id = ?
            """,
            (analysis_id,)
        ).fetchone()

    return dict(row) if row else None


def _get_cached_knowledge(conn, source_type: str, analysis_id: int):
    row = conn.execute(
        """
        SELECT knowledge_json
        FROM knowledge_intelligence
        WHERE source_type = ? AND analysis_id = ?
        """,
        (source_type, analysis_id)
    ).fetchone()

    return json.loads(row["knowledge_json"]) if row else None


def _save_knowledge_cache(conn, source_type: str, analysis_id: int, knowledge: dict):
    conn.execute(
        """
        INSERT INTO knowledge_intelligence
            (source_type, analysis_id, knowledge_json, model, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(source_type, analysis_id) DO UPDATE SET
            knowledge_json = excluded.knowledge_json,
            model          = excluded.model,
            updated_at     = datetime('now')
        """,
        (source_type, analysis_id, json.dumps(knowledge), None)
    )


@router.post("/knowledge/intelligence")
def get_knowledge_intelligence(request: KnowledgeIntelligenceRequest):
    """
    Extract structured knowledge (topics, entities, systems, tools,
    relationships, etc.) from an already-analyzed URL or PDF source.
    """

    source_type = "pdf" if (request.source_type or "").strip().lower() == "pdf" else "website"
    analysis_id = request.analysis_id

    try:
        with db() as conn:

            source = _get_analysis_source(conn, source_type, analysis_id)

            if not source:
                return {
                    "success": False,
                    "message": "Source not found."
                }

            if not source.get("chunks_json"):
                return {
                    "success": False,
                    "message": "This source has no extracted content available."
                }

            if not request.force_refresh:
                cached = _get_cached_knowledge(conn, source_type, analysis_id)

                if cached is not None:
                    return {
                        "success": True,
                        "cached": True,
                        "source": {
                            "title": source.get("title") or "",
                            "url": source.get("ref") or "",
                            "source_type": source_type
                        },
                        "knowledge": cached
                    }

            chunks = json.loads(source["chunks_json"])

            knowledge = extract_knowledge(
                chunks=chunks,
                title=source.get("title") or "",
                source_url=source.get("ref") or "",
                source_type=source_type
            )

            _save_knowledge_cache(conn, source_type, analysis_id, knowledge)

        return {
            "success": True,
            "cached": False,
            "source": {
                "title": source.get("title") or "",
                "url": source.get("ref") or "",
                "source_type": source_type
            },
            "knowledge": knowledge
        }

    except ValueError as exc:
        return {
            "success": False,
            "message": str(exc)
        }

    except Exception as exc:
        print("Knowledge Intelligence error:", str(exc))
        return {
            "success": False,
            "message": "Helix AI could not extract structured knowledge for this source."
        }

