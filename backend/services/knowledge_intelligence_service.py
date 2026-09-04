"""Groq-based structured knowledge extraction for Helix AI (Knowledge Intelligence).

Takes content already extracted/chunked by the existing URL (Firecrawl) or
PDF (PyMuPDF) pipelines and asks Groq to identify topics, key facts, entities,
systems, tools, technologies, processes, risks, relationships, and suggested
questions. This is knowledge extraction, not question answering — it does not
use `rag_service.retrieve_relevant_chunks` (which requires a question); it
reuses `context_builder.build_context` directly on the full, already-ordered
chunk list to stay within a bounded context size.
"""

import json
import os
import re
from typing import Dict, List

from dotenv import load_dotenv
from groq import Groq

from services.context_builder import build_context


load_dotenv()


# =========================================================
# Configuration
# =========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)
GROQ_TEMPERATURE = float(
    os.getenv(
        "GROQ_TEMPERATURE",
        "0.2"
    )
)

# Kept well below the Groq org's 8000 tokens-per-minute cap for this model
# (context + prompt overhead + declared max_completion_tokens all count
# against that single limit) — see the rate-limit handling below.
KI_MAX_CONTEXT_CHARS = int(
    os.getenv(
        "KI_MAX_CONTEXT_CHARS",
        "12000"
    )
)
KI_MAX_OUTPUT_TOKENS = int(
    os.getenv(
        "KI_MAX_OUTPUT_TOKENS",
        "3000"
    )
)

# Bounds applied to every list field so a runaway model response can never
# blow up storage or the API payload.
MAX_LIST_ITEMS = 40
MAX_SUGGESTED_QUESTIONS = 10
MAX_RELATIONSHIPS = 40

SCHEMA_LIST_FIELDS = (
    "topics",
    "key_facts",
    "entities",
    "systems",
    "tools",
    "technologies",
    "processes",
    "risks",
)


if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is not configured in backend/.env"
    )


groq_client = Groq(api_key=GROQ_API_KEY)


print("[GROQ] Knowledge Intelligence service initialized.")
print("[GROQ] Model:", GROQ_MODEL)


# =========================================================
# Context Preparation
# =========================================================

def prepare_extraction_context(
    chunks: List[Dict],
    max_context_chars: int = KI_MAX_CONTEXT_CHARS
) -> str:
    """
    Build a bounded, structural-noise-free context from the full, already
    chunked source content (in original document order).
    """

    if not chunks:
        return ""

    result = build_context(
        relevant_chunks=chunks,
        max_context_chars=max_context_chars
    )

    if not result.get("success"):
        return ""

    return result.get("context", "")


# =========================================================
# Prompt
# =========================================================

def build_extraction_prompt(
    content: str,
    title: str,
    source_url: str,
    source_type: str
) -> (str, str):
    """Build the dedicated knowledge-extraction system/user prompts."""

    evidence_noun = "document" if source_type == "pdf" else "website"

    system_prompt = f"""
You are Helix AI's Knowledge Intelligence engine.

This is KNOWLEDGE EXTRACTION, not question answering. Your job is to read
the supplied {evidence_noun} evidence and produce a structured representation
of the knowledge it contains — not to answer a user's question and not to
repeat the entire document.

RULES:

1. Use ONLY the supplied evidence. Never invent facts, entities,
   relationships, numbers, or names that are not clearly present.
2. Identify what is important and reusable, not every sentence. Skip
   boilerplate, navigation, and filler.
3. Remove duplicates — do not list the same topic, fact, or entity twice
   in different words.
4. Keep every entity/topic/tool/system/technology/process/risk name short
   and concise (a few words, not a sentence).
5. Only create a relationship when the evidence directly supports it. Each
   relationship must have a short "source", a short lowercase verb-like
   "relationship" (e.g. "uses", "supports", "extends", "depends on"), and a
   short "target".
6. Suggested questions must be questions a reader of this evidence would
   plausibly want answered next, grounded in what is actually covered.
7. If the evidence does not support a category (e.g. no clear risks), return
   an empty list for it rather than inventing content.
8. Return ONLY valid JSON. No prose, no Markdown code fences, no commentary
   before or after the JSON.

Return exactly this JSON shape (all keys required, arrays may be empty):

{{
  "title": "",
  "summary": "",
  "topics": [],
  "key_facts": [],
  "entities": [],
  "systems": [],
  "tools": [],
  "technologies": [],
  "processes": [],
  "risks": [],
  "relationships": [
    {{"source": "", "relationship": "", "target": ""}}
  ],
  "suggested_questions": []
}}
"""

    user_prompt = f"""
SOURCE TITLE:
{title or "Unknown"}

SOURCE REFERENCE:
{source_url or "Unknown"}

{evidence_noun.upper()} EVIDENCE:

{content}

Extract the structured knowledge now. Return only the JSON object described
above.
"""

    return system_prompt, user_prompt


# =========================================================
# Safe JSON Parsing / Recovery
# =========================================================

_JSON_FENCE_PATTERN = re.compile(
    r"```(?:json)?\s*(.*?)\s*```",
    re.DOTALL | re.IGNORECASE
)


def _parse_model_json(raw: str) -> Dict:
    """
    Parse the model's response into a dict, attempting safe recovery from
    common formatting mistakes (Markdown fences, leading/trailing prose)
    before giving up.
    """

    raw = (raw or "").strip()

    if not raw:
        raise ValueError("The model returned an empty response.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    fence_match = _JSON_FENCE_PATTERN.search(raw)

    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    start = raw.find("{")
    end = raw.rfind("}")

    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError("The model returned invalid JSON.")


# =========================================================
# Normalization / Validation
# =========================================================

def _clean_string_list(values, max_items: int) -> List[str]:
    """Coerce to a deduped, order-preserving list of non-empty strings."""

    if not isinstance(values, list):
        return []

    seen = set()
    cleaned = []

    for value in values:

        if not isinstance(value, str):
            continue

        text = value.strip()

        if not text:
            continue

        key = text.lower()

        if key in seen:
            continue

        seen.add(key)
        cleaned.append(text)

        if len(cleaned) >= max_items:
            break

    return cleaned


def _clean_relationships(values) -> List[Dict]:
    """Keep only well-formed {source, relationship, target} entries."""

    if not isinstance(values, list):
        return []

    seen = set()
    cleaned = []

    for item in values:

        if not isinstance(item, dict):
            continue

        source = str(item.get("source") or "").strip()
        relationship = str(item.get("relationship") or "").strip()
        target = str(item.get("target") or "").strip()

        if not source or not relationship or not target:
            continue

        key = (source.lower(), relationship.lower(), target.lower())

        if key in seen:
            continue

        seen.add(key)
        cleaned.append({
            "source": source,
            "relationship": relationship,
            "target": target
        })

        if len(cleaned) >= MAX_RELATIONSHIPS:
            break

    return cleaned


def _normalize_knowledge(raw: Dict, fallback_title: str) -> Dict:
    """Guarantee the full schema is present, well-typed, and bounded."""

    if not isinstance(raw, dict):
        raw = {}

    title = str(raw.get("title") or fallback_title or "").strip()
    summary = str(raw.get("summary") or "").strip()

    normalized = {
        "title": title,
        "summary": summary,
        "relationships": _clean_relationships(raw.get("relationships")),
        "suggested_questions": _clean_string_list(
            raw.get("suggested_questions"),
            MAX_SUGGESTED_QUESTIONS
        ),
    }

    for field in SCHEMA_LIST_FIELDS:
        normalized[field] = _clean_string_list(
            raw.get(field),
            MAX_LIST_ITEMS
        )

    return normalized


# =========================================================
# Extraction Entry Point
# =========================================================

def extract_knowledge(
    chunks: List[Dict],
    title: str,
    source_url: str,
    source_type: str = "website"
) -> Dict:
    """
    Run Knowledge Intelligence extraction on already-chunked source content
    and return a normalized structured knowledge dict.
    """

    print("\n" + "=" * 60)
    print("KNOWLEDGE INTELLIGENCE")
    print("=" * 60)
    print("Source type:", source_type)
    print("Source:", source_url or "Unknown")
    print("Chunks available:", len(chunks or []))

    context = prepare_extraction_context(chunks)

    if not context:
        raise ValueError(
            "No usable content is available for knowledge extraction."
        )

    print("Context characters used:", len(context))

    system_prompt, user_prompt = build_extraction_prompt(
        content=context,
        title=title,
        source_url=source_url,
        source_type=source_type
    )

    print("Groq extraction started")

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=GROQ_TEMPERATURE,
            max_completion_tokens=KI_MAX_OUTPUT_TOKENS,
        )

        raw_answer = response.choices[0].message.content or ""
        finish_reason = response.choices[0].finish_reason

        print("Groq finish reason:", finish_reason)
        print("Raw response characters:", len(raw_answer))

    except Exception as exc:
        print("[GROQ] Knowledge extraction request failed:", str(exc))
        if "rate_limit_exceeded" in str(exc) or "tokens per minute" in str(exc):
            raise ValueError(
                "This source is too large to extract right now due to a "
                "temporary rate limit. Please try again in a moment."
            ) from exc
        raise RuntimeError("Groq extraction failed") from exc

    try:
        parsed = _parse_model_json(raw_answer)
    except ValueError:
        print("[GROQ] Raw response that failed JSON parsing (first 1000 chars):")
        print(raw_answer[:1000])
        raise

    knowledge = _normalize_knowledge(parsed, fallback_title=title)

    print("Knowledge extraction completed")
    print("=" * 60)

    return knowledge
