"""
uploads.py — File upload, storage, and text extraction for LLM context
"""
import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from database import db_save_document, db_get_documents, db_get_document, db_delete_document, db_get_all_extracted_texts

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

def extract_text_from_file(file_path: str, content_type: str) -> str:
    """Extract readable text from uploaded file for LLM context."""
    text = ""
    try:
        if content_type == "application/pdf":
            try:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            except ImportError:
                try:
                    import PyPDF2
                    with open(file_path, "rb") as f:
                        reader = PyPDF2.PdfReader(f)
                        text = "\n".join(page.extract_text() or "" for page in reader.pages)
                except ImportError:
                    text = "[PDF text extraction requires pdfplumber: pip install pdfplumber]"

        elif content_type == "text/plain":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

        elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            try:
                from docx import Document
                doc = Document(file_path)
                text = "\n".join(p.text for p in doc.paragraphs)
            except ImportError:
                text = "[DOCX extraction requires python-docx: pip install python-docx]"

        elif content_type.startswith("image/"):
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(file_path)
                text = pytesseract.image_to_string(img)
            except ImportError:
                text = "[Image OCR requires pytesseract + Pillow: pip install pytesseract Pillow]"

    except Exception as e:
        text = f"[Text extraction failed: {e}]"

    return text.strip()


@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    content_type = file.content_type or "application/octet-stream"

    if content_type not in ALLOWED_TYPES and not content_type.startswith("image/"):
        raise HTTPException(400, f"File type not supported: {content_type}")

    ext = ALLOWED_TYPES.get(content_type, os.path.splitext(file.filename or "")[-1])
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path   = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size     = os.path.getsize(file_path)
    extracted     = extract_text_from_file(file_path, content_type)

    doc = db_save_document(
        filename      = unique_name,
        original_name = file.filename or unique_name,
        file_type     = content_type,
        file_size     = file_size,
        file_path     = file_path,
        extracted_text= extracted,
    )
    return doc


@router.get("/")
def list_documents():
    docs = db_get_documents()
    # Add URL for frontend
    for d in docs:
        d["url"] = f"/uploads/{d['filename']}"
        d["has_text"] = bool(d.get("extracted_text"))
        d["preview"] = (d.get("extracted_text") or "")[:300]
    return docs


@router.get("/context")
def get_llm_context():
    """Return all extracted document texts for LLM context injection."""
    texts = db_get_all_extracted_texts()
    if not texts:
        return {"context": "", "document_count": 0}
    context_parts = []
    for t in texts:
        if t["extracted_text"]:
            context_parts.append(f"=== Document: {t['original_name']} ===\n{t['extracted_text'][:3000]}")
    return {
        "context": "\n\n".join(context_parts),
        "document_count": len(texts)
    }


@router.get("/{doc_id}")
def get_document(doc_id: int):
    doc = db_get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    doc["url"] = f"/uploads/{doc['filename']}"
    return doc


@router.delete("/{doc_id}")
def delete_document(doc_id: int):
    db_delete_document(doc_id)
    return {"success": True}
