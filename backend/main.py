"""
main.py — FastAPI backend for Bosch Knowledge Agent Dashboard
Run: uvicorn main:app --reload --port 8000
"""
import os, sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Create data dirs
os.makedirs("data",    exist_ok=True)
os.makedirs("uploads", exist_ok=True)

from database import init_db
init_db()

from routers import resources, files, voice, knowledge, url, pdf

app = FastAPI(title="Bosch Knowledge Agent API", version="2.0.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(resources.router,  prefix="/api")
app.include_router(files.router,      prefix="/api")
app.include_router(voice.router,      prefix="/api")
app.include_router(knowledge.router,  prefix="/api")
app.include_router(url.router,        prefix="/api")
app.include_router(pdf.router,        prefix="/api")

@app.get("/api/health")
def health(): return {"status": "ok", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    print("=" * 55)
    print("  Bosch Knowledge Agent — Dashboard Backend v2")
    print("=" * 55)
    print("API:       http://localhost:8000")
    print("Docs:      http://localhost:8000/docs")
    print("Frontend:  http://localhost:5173  (run: npm run dev)")
    print("=" * 55)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
