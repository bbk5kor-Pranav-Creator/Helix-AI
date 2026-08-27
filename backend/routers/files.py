"""
files.py — File upload, storage, text extraction, and LLM context
Supports: PDF, PNG, JPG, WEBP, DOC, DOCX
"""
import os, uuid, shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from database import db

router     = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED = {
    "application/pdf":                                                          "pdf",
    "image/png":                                                                "png",
    "image/jpeg":                                                               "jpg",
    "image/jpg":                                                                "jpg",
    "image/webp":                                                               "webp",
    "application/msword":                                                       "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":  "docx",
}

# Also match by filename extension as fallback (Windows sometimes sends wrong MIME)
EXT_MAP = {
    ".pdf":  "pdf",
    ".png":  "png",
    ".jpg":  "jpg",
    ".jpeg": "jpg",
    ".webp": "webp",
    ".doc":  "doc",
    ".docx": "docx",
}


def detect_type(content_type: str, filename: str) -> str | None:
    """Detect file type from content-type or filename extension."""
    if content_type in ALLOWED:
        return ALLOWED[content_type]
    ext = os.path.splitext(filename or "")[1].lower()
    return EXT_MAP.get(ext)


def extract_text(path: str, ftype: str) -> tuple[str, int]:
    """Extract text from uploaded file. Returns (text, page_count)."""
    text  = ""
    pages = 0
    try:
        if ftype == "pdf":
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                pages = len(pdf.pages)
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text += t + "\n"

        elif ftype == "docx":
            try:
                import docx
                doc = docx.Document(path)
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                # Also extract text from tables
                for table in doc.tables:
                    for row in table.rows:
                        row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                        if row_text:
                            paragraphs.append(row_text)
                text  = "\n".join(paragraphs)
                pages = max(1, len(doc.paragraphs) // 30)  # rough estimate
            except ImportError:
                text  = "[DOCX extraction failed: python-docx not installed. Run: pip install python-docx]"
                pages = 0

        elif ftype == "doc":
            # .doc (old Word format) — try antiword or python-docx fallback
            try:
                import subprocess
                result = subprocess.run(
                    ["antiword", path], capture_output=True, text=True, timeout=10
                )
                if result.returncode == 0:
                    text  = result.stdout
                    pages = max(1, text.count("\n") // 40)
                else:
                    text = "[DOC extraction: antiword not available. Convert to DOCX for best results.]"
            except (FileNotFoundError, Exception):
                text  = "[DOC format: Install antiword or convert to DOCX for text extraction.]"
                pages = 0

        elif ftype in ("png", "jpg", "webp"):
            try:
                import pytesseract
                from PIL import Image
                img   = Image.open(path)
                text  = pytesseract.image_to_string(img)
                pages = 1
            except ImportError:
                text  = "[Image uploaded — OCR not available. Install pytesseract for text extraction.]"
                pages = 1

    except Exception as e:
        text = f"[Text extraction failed: {e}]"

    return text.strip(), pages


@router.post("/files/upload", status_code=201)
async def upload_file(file: UploadFile = File(...)):
    ct    = file.content_type or ""
    ftype = detect_type(ct, file.filename)

    if not ftype:
        raise HTTPException(
            400,
            f"File type not supported. Allowed: PDF, DOCX, DOC, PNG, JPG, WEBP. "
            f"Got content-type: '{ct}', filename: '{file.filename}'"
        )

    stored = f"{uuid.uuid4().hex}.{ftype}"
    path   = os.path.join(UPLOAD_DIR, stored)

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    size         = os.path.getsize(path)
    text, pages  = extract_text(path, ftype)
    extracted_ok = 1 if text and not text.startswith("[") else 0

    with db() as conn:
        cur = conn.execute(
            """INSERT INTO uploaded_files
               (original_name, stored_name, file_type, file_size, page_count, extracted_text, text_extracted)
               VALUES (?,?,?,?,?,?,?)""",
            (file.filename, stored, ftype, size, pages, text, extracted_ok)
        )
        row = conn.execute(
            "SELECT * FROM uploaded_files WHERE id=?", (cur.lastrowid,)
        ).fetchone()
    return dict(row)


@router.get("/files")
def list_files():
    with db() as conn:
        rows = conn.execute(
            "SELECT id, original_name, stored_name, file_type, file_size, "
            "page_count, text_extracted, uploaded_at "
            "FROM uploaded_files ORDER BY uploaded_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/files/{fid}/content")
def get_file_content(fid: int):
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM uploaded_files WHERE id=?", (fid,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "File not found")
    path = os.path.join(UPLOAD_DIR, row["stored_name"])
    if not os.path.exists(path):
        raise HTTPException(404, "File missing from disk")
    media = {
        "pdf":  "application/pdf",
        "png":  "image/png",
        "jpg":  "image/jpeg",
        "webp": "image/webp",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc":  "application/msword",
    }
    return FileResponse(
        path,
        media_type=media.get(row["file_type"], "application/octet-stream"),
        filename=row["original_name"]
    )


@router.get("/files/{fid}/text")
def get_file_text(fid: int):
    with db() as conn:
        row = conn.execute(
            "SELECT original_name, extracted_text, text_extracted FROM uploaded_files WHERE id=?",
            (fid,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "File not found")
    return {
        "name":      row["original_name"],
        "text":      row["extracted_text"],
        "extracted": bool(row["text_extracted"])
    }


@router.delete("/files/{fid}")
def delete_file(fid: int):
    with db() as conn:
        row = conn.execute(
            "SELECT stored_name FROM uploaded_files WHERE id=?", (fid,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        path = os.path.join(UPLOAD_DIR, row["stored_name"])
        if os.path.exists(path):
            os.remove(path)
        conn.execute("DELETE FROM uploaded_files WHERE id=?", (fid,))
    return {"deleted": True}


@router.get("/files/context/llm")
def get_all_files_llm_context():
    """Returns all uploaded file texts combined for LLM context injection."""
    with db() as conn:
        rows = conn.execute(
            "SELECT original_name, extracted_text FROM uploaded_files WHERE text_extracted=1"
        ).fetchall()
    if not rows:
        return {"context": ""}
    parts = []
    for r in rows:
        if r["extracted_text"] and not r["extracted_text"].startswith("["):
            parts.append(
                f"[Document: {r['original_name']}]\n{r['extracted_text'][:3000]}"
            )
    return {"context": "\n\n---\n\n".join(parts)}
