"""
knowledge.py — Knowledge base query and stats routes
"""
from fastapi import APIRouter
from database import db
from collections import defaultdict

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
