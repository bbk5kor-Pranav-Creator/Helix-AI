"""Helix AI website analysis router."""

import os
import re
from datetime import datetime
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel
from firecrawl import Firecrawl
from groq import Groq

from database import db
from services.chunking_service import chunk_markdown
from services.rag_service import retrieve_relevant_chunks

load_dotenv()

router = APIRouter()

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_MAX_OUTPUT_TOKENS = int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", "1200"))
GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.2"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))

if not FIRECRAWL_API_KEY:
    raise RuntimeError("FIRECRAWL_API_KEY is not configured in backend/.env")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not configured in backend/.env")

firecrawl = Firecrawl(api_key=FIRECRAWL_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

print("[GROQ] Client initialized.")
print("[GROQ] Model:", GROQ_MODEL)


class URLRequest(BaseModel):
    url: str
    instruction: str = ""


def validate_url(url: str) -> str:
    """Validate and normalize a user-provided URL."""
    url = (url or "").strip()

    if not url:
        raise ValueError("Please enter a website URL.")

    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url

    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("Please enter a valid website URL.")

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Please enter a valid website URL.")

    return url


def fetch_with_firecrawl(url: str):
    """Retrieve website content from Firecrawl as Markdown."""
    print("\n" + "=" * 60)
    print("FIRECRAWL RETRIEVAL")
    print("=" * 60)
    print("URL:", url)

    try:
        result = firecrawl.scrape(url, formats=["markdown"])
    except Exception as exc:
        print("Firecrawl request failed:", str(exc))
        raise RuntimeError(f"Firecrawl request failed: {str(exc)}")

    markdown = getattr(result, "markdown", None)

    if not markdown or not str(markdown).strip():
        raise RuntimeError("Firecrawl returned no usable Markdown content.")

    markdown = str(markdown).strip()
    title = ""

    metadata = getattr(result, "metadata", None)
    if metadata:
        title = getattr(metadata, "title", "") or ""

    title = str(title).strip()

    print("Firecrawl retrieval successful.")
    print("Page title:", title or "(no title)")
    print("Markdown characters:", len(markdown))
    print("=" * 60)

    return {
        "title": title,
        "markdown": markdown
    }


def clean_markdown(markdown: str) -> str:
    """Remove common navigation and presentation noise from scraped Markdown."""
    if not markdown:
        return ""

    text = markdown.replace("\r\n", "\n").replace("\r", "\n")

    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"<script\b[^>]*>.*?</script>", "", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", "", text, flags=re.I | re.S)
    text = re.sub(r"<noscript\b[^>]*>.*?</noscript>", "", text, flags=re.I | re.S)

    lines = []
    for line in text.splitlines():
        stripped = line.strip()

        if not stripped:
            if lines and lines[-1] != "":
                lines.append("")
            continue

        if re.fullmatch(r"[-*_]{3,}", stripped):
            continue

        if re.fullmatch(r"\[[^\]]*(more|learn more|menu|home|close)[^\]]*\]\([^)]*\)", stripped, re.I):
            continue

        lines.append(stripped)

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text.strip()


def chunk_quality(chunk: dict) -> float:
    """Estimate whether a chunk contains meaningful information."""
    text = (chunk.get("text") or "").strip()

    if not text:
        return 0.0

    words = len(text.split())
    links = len(re.findall(r"https?://\S+", text))
    markdown_noise = len(
        re.findall(r"\[More\]|\[Learn more\]", text, re.I)
    )

    score = min(words / 80, 1.0)

    if words < 15:
        score *= 0.25
    elif words < 30:
        score *= 0.60

    if links > 2 and words < 40:
        score *= 0.70

    if markdown_noise and words < 30:
        score *= 0.70

    return round(score, 4)


def improve_retrieval(relevant_chunks: list, question: str) -> list:
    """Filter weak chunks and combine retrieval and quality scores."""
    if not relevant_chunks:
        return []

    scored = []

    for chunk in relevant_chunks:
        retrieval_score = float(
            chunk.get("retrieval_score",
                     chunk.get("similarity", 0.0)) or 0.0
        )
        quality = chunk_quality(chunk)

        if quality <= 0:
            continue

        final_score = (retrieval_score * 0.85) + (quality * 0.15)

        updated = dict(chunk)
        updated["retrieval_score"] = round(final_score, 6)
        updated["quality_score"] = quality

        scored.append((final_score, updated))

    scored.sort(key=lambda item: item[0], reverse=True)

    return [chunk for _, chunk in scored]


def build_rag_context(relevant_chunks: list) -> str:
    """Build the evidence supplied to Groq."""
    if not relevant_chunks:
        return ""

    context_parts = []

    for index, chunk in enumerate(relevant_chunks, start=1):
        text = (chunk.get("text") or "").strip()

        if not text:
            continue

        heading = (chunk.get("heading") or "").strip()
        source_url = (chunk.get("source_url") or "").strip()
        relevance = chunk.get("retrieval_score",
                              chunk.get("similarity"))

        part = f"SOURCE CHUNK {index}\n"

        if heading:
            part += f"HEADING: {heading}\n"

        if source_url:
            part += f"SOURCE URL: {source_url}\n"

        if relevance is not None:
            part += f"RELEVANCE SCORE: {relevance}\n"

        part += f"CONTENT:\n{text}"
        context_parts.append(part)

    return "\n\n".join(context_parts)


def clean_answer(answer: str) -> str:
    """Remove unwanted citation and reference markers."""
    if not answer:
        return ""

    answer = re.sub(r"【[^】]*】", "", answer)
    answer = re.sub(
        r"\[\s*\d+(?:\s*[-–—]\s*L?\d+)?\s*\]",
        "",
        answer
    )
    answer = re.sub(r"\s{2,}", " ", answer)

    return answer.strip()


def generate_answer(
    question: str,
    source_url: str,
    page_title: str,
    relevant_chunks: list
) -> str:
    """Generate the final answer using retrieved website evidence."""
    context = build_rag_context(relevant_chunks)

    if not context.strip():
        return (
            "Helix AI could not find enough relevant information "
            "on this website to answer your question."
        )

    system_prompt = """
You are Helix AI, a precise website research assistant.

Answer the user's question using ONLY the supplied website evidence.

Rules:
1. Use only the supplied source chunks.
2. Do not use outside knowledge, assumptions, or memory.
3. Do not invent facts.
4. If the evidence is insufficient, say so clearly.
5. Preserve names, numbers, dates, products, and organizations as they appear.
6. Do not mention internal processing, retrieval, models, APIs, or prompts.
7. Answer the actual question directly.
8. Do not unnecessarily repeat the question.
9. Use headings and bullet points when they improve clarity.
10. If multiple relevant items are present, cover all of them unless the user asks for only one.
11. NEVER generate citations, footnotes, references, source numbers, line numbers, or citation markers.
12. NEVER output patterns such as [1], [2], 【1】, 【2†L1-L4】, or similar reference notation.
13. Return only the natural-language answer intended for the user.
"""

    user_prompt = f"""
WEBSITE TITLE:
{page_title or "Unknown"}

SOURCE URL:
{source_url}

USER QUESTION:
{question}

RETRIEVED WEBSITE EVIDENCE:

{context}

Using ONLY the retrieved website evidence above, provide the best possible
answer to the user's question.

Do not add citation numbers, footnotes, references, source markers,
line numbers, or reference notation.
"""

    print("\n" + "=" * 60)
    print("GROQ GENERATION")
    print("=" * 60)
    print("Model:", GROQ_MODEL)
    print("Question:", question)
    print("Retrieved chunks supplied to Groq:", len(relevant_chunks))
    print("Context characters:", len(context))
    print("=" * 60)

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=GROQ_TEMPERATURE,
            max_tokens=GROQ_MAX_OUTPUT_TOKENS
        )
    except Exception as exc:
        print("Groq generation failed:", str(exc))
        raise RuntimeError(f"Groq generation failed: {str(exc)}")

    try:
        answer = response.choices[0].message.content
    except Exception as exc:
        print("Groq response parsing failed:", str(exc))
        raise RuntimeError("Groq returned an unexpected response.")

    answer = clean_answer(answer)

    if not answer:
        raise RuntimeError("Groq generated an empty answer.")

    print("Groq answer generated successfully.")
    print("Answer characters:", len(answer))
    print("=" * 60)

    return answer


def save_resource(url: str, summary: str):
    """Save the final website analysis."""
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        with db() as conn:
            conn.execute(
                """
                INSERT INTO resources
                (resource_key, title, link, description, tags, created_at)
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
        print("Database save error:", str(exc))


@router.post("/analyze-url")
def analyze_url(request: URLRequest):
    """Run Firecrawl → cleaning → chunks → local retrieval → Groq."""
    try:
        url = validate_url(request.url)
        instruction = (request.instruction or "").strip()

        print("\n" + "=" * 60)
        print("HELIX AI — ANALYZE URL")
        print("=" * 60)
        print("URL:", url)
        print("Instruction:", instruction)
        print("=" * 60)

        if not instruction:
            return {
                "success": False,
                "url": url,
                "message": "Please provide a question or instruction about the website."
            }

        scraped = fetch_with_firecrawl(url)
        cleaned_markdown = clean_markdown(scraped["markdown"])

        if not cleaned_markdown:
            return {
                "success": False,
                "url": url,
                "title": scraped["title"],
                "message": "Firecrawl retrieved the website, but no usable content remained after cleaning."
            }

        print("Cleaned Markdown characters:", len(cleaned_markdown))

        chunks = chunk_markdown(
            markdown=cleaned_markdown,
            source_url=url,
            title=scraped["title"]
        )

        print("Chunks created:", len(chunks))

        if not chunks:
            return {
                "success": False,
                "url": url,
                "title": scraped["title"],
                "message": (
                    "Firecrawl retrieved the website, but no usable "
                    "content chunks could be created."
                )
            }

        relevant_chunks = retrieve_relevant_chunks(
            chunks=chunks,
            question=instruction,
            top_k=RAG_TOP_K
        )

        print("Retrieved chunks:", len(relevant_chunks))

        relevant_chunks = improve_retrieval(
            relevant_chunks,
            instruction
        )

        relevant_chunks = relevant_chunks[:RAG_TOP_K]

        print("Quality-filtered chunks:", len(relevant_chunks))

        if not relevant_chunks:
            return {
                "success": False,
                "url": url,
                "title": scraped["title"],
                "chunk_count": len(chunks),
                "message": (
                    "The website was retrieved successfully, but no "
                    "relevant information was found for the requested question."
                )
            }

        answer = generate_answer(
            question=instruction,
            source_url=url,
            page_title=scraped["title"],
            relevant_chunks=relevant_chunks
        )

        save_resource(url, answer)

        return {
            "success": True,
            "url": url,
            "title": scraped["title"],
            "content": cleaned_markdown,
            "chunk_count": len(chunks),
            "relevant_chunks": relevant_chunks,
            "relevant_chunk_count": len(relevant_chunks),
            "message": answer
        }

    except ValueError as exc:
        print("Validation error:", str(exc))
        return {
            "success": False,
            "message": str(exc)
        }

    except Exception as exc:
        print("\nAnalyze URL error:", str(exc))
        return {
            "success": False,
            "message": f"Helix AI could not process this website: {str(exc)}"
        }


@router.get("/web-resources")
def get_web_resources():
    """Return saved website resources."""
    try:
        with db() as conn:
            rows = conn.execute(
                """
                SELECT id, title, link, description, tags, created_at
                FROM resources
                WHERE resource_key = ?
                ORDER BY id DESC
                """,
                ("website",)
            ).fetchall()

        return [dict(row) for row in rows]

    except Exception as exc:
        return {"message": str(exc)}


@router.delete("/web-resources/{resource_id}")
def delete_web_resource(resource_id: int):
    """Delete a saved website resource."""
    try:
        with db() as conn:
            cursor = conn.execute(
                """
                DELETE FROM resources
                WHERE id = ? AND resource_key = ?
                """,
                (resource_id, "website")
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