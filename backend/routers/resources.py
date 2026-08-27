from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import db

router = APIRouter()

VALID_KEYS = {"docupedia","sharepoint","teams","outlook","jira","solman","signavio","track-release"}

class ResourceIn(BaseModel):
    title:       str
    link:        Optional[str] = None
    description: Optional[str] = None
    tags:        Optional[str] = None

def row_to_dict(row):
    return dict(row)

@router.get("/resources/{key}")
def list_resources(key: str):
    if key not in VALID_KEYS:
        raise HTTPException(404, f"Unknown resource key: {key}")
    with db() as conn:
        rows = conn.execute("SELECT * FROM resources WHERE resource_key=? ORDER BY created_at DESC", (key,)).fetchall()
    return [row_to_dict(r) for r in rows]

@router.post("/resources/{key}", status_code=201)
def create_resource(key: str, body: ResourceIn):
    if key not in VALID_KEYS:
        raise HTTPException(404, f"Unknown resource key: {key}")
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO resources (resource_key, title, link, description, tags) VALUES (?,?,?,?,?)",
            (key, body.title, body.link, body.description, body.tags)
        )
        row = conn.execute("SELECT * FROM resources WHERE id=?", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)

@router.put("/resources/{key}/{rid}")
def update_resource(key: str, rid: int, body: ResourceIn):
    if key not in VALID_KEYS:
        raise HTTPException(404, f"Unknown resource key: {key}")
    with db() as conn:
        conn.execute(
            "UPDATE resources SET title=?, link=?, description=?, tags=?, updated_at=datetime('now') WHERE id=? AND resource_key=?",
            (body.title, body.link, body.description, body.tags, rid, key)
        )
        row = conn.execute("SELECT * FROM resources WHERE id=?", (rid,)).fetchone()
    if not row:
        raise HTTPException(404, "Resource not found")
    return row_to_dict(row)

@router.delete("/resources/{key}/{rid}")
def delete_resource(key: str, rid: int):
    if key not in VALID_KEYS:
        raise HTTPException(404, f"Unknown resource key: {key}")
    with db() as conn:
        conn.execute("DELETE FROM resources WHERE id=? AND resource_key=?", (rid, key))
    return {"deleted": True}

@router.get("/resources/{key}/context/llm")
def get_llm_context(key: str):
    if key not in VALID_KEYS:
        raise HTTPException(404, f"Unknown resource key: {key}")
    with db() as conn:
        rows = conn.execute("SELECT * FROM resources WHERE resource_key=?", (key,)).fetchall()
    if not rows:
        return {"context": ""}
    lines = [f"[{key.upper()} Resources]"]
    for r in rows:
        tag_str = f" [tags: {r['tags']}]" if r.get('tags') else ""
        lines.append(f"- {r['title']}: {r['description'] or ''}{tag_str} | Link: {r['link'] or 'N/A'}")
    return {"context": "\n".join(lines)}
