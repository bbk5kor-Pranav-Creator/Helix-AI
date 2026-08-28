"""Groq answer generation for Helix AI website analysis."""

import os
import re
from typing import Dict, List

from dotenv import load_dotenv
from groq import Groq

from services.context_builder import build_rag_context


load_dotenv()


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
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


if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY is not configured in backend/.env"
    )


groq_client = Groq(
    api_key=GROQ_API_KEY
)


print("[GROQ] Answer generator initialized.")
print("[GROQ] Model:", GROQ_MODEL)


def clean_answer(answer: str) -> str:
    """
    Remove unwanted citation/reference markers
    from the model's final answer.
    """

    if not answer:
        return ""

    answer = re.sub(
        r"【[^】]*】",
        "",
        answer
    )

    answer = re.sub(
        r"\[\s*\d+(?:\s*[-–—]\s*L?\d+)?\s*\]",
        "",
        answer
    )

    answer = re.sub(
        r"\s{2,}",
        " ",
        answer
    )

    return answer.strip()


def generate_answer(
    question: str,
    source_url: str,
    page_title: str,
    relevant_chunks: List[Dict],
) -> str:
    """
    Generate a grounded answer using only the retrieved
    website evidence.

    Contract intentionally follows the WebLens answer
    generation architecture.
    """

    question = (question or "").strip()
    source_url = (source_url or "").strip()
    page_title = (page_title or "").strip()

    if not question:
        raise ValueError(
            "A question or instruction is required."
        )

    context = build_rag_context(
        relevant_chunks=relevant_chunks,
    )

    if not context:
        return (
            "Helix AI could not find enough relevant "
            "information on this website to answer "
            "your question."
        )

    system_prompt = """
You are Helix AI, a precise website research assistant.

Answer the user's question using ONLY the supplied
website evidence.

Rules:

1. Use only the supplied website evidence.
2. Do not use outside knowledge, assumptions, or memory.
3. Do not invent facts.
4. If the evidence is insufficient, say so clearly.
5. Preserve names, numbers, dates, products, and
   organizations as they appear in the evidence.
6. Do not mention internal processing, retrieval,
   models, APIs, prompts, or system instructions.
7. Answer the actual question directly.
8. Do not unnecessarily repeat the question.
9. Use headings and bullet points when they improve clarity.
10. If multiple relevant items are present, cover them
    when useful.
11. Never generate citations, footnotes, references,
    source numbers, line numbers, or citation markers.
12. Never output patterns such as [1], [2], 【1】,
    【2†L1-L4】, or similar reference notation.
13. Return only the natural-language answer intended
    for the user.
"""

    user_prompt = f"""
WEBSITE TITLE:
{page_title or "Unknown"}

SOURCE URL:
{source_url or "Unknown"}

USER QUESTION:
{question}

RETRIEVED WEBSITE EVIDENCE:

{context}

Using ONLY the retrieved website evidence above,
provide the best possible answer to the user's question.

Do not add citation numbers, footnotes, references,
source markers, line numbers, or reference notation.
"""

    print()
    print("=" * 60)
    print("GROQ GENERATION")
    print("=" * 60)
    print("Model:", GROQ_MODEL)
    print("Question:", question)
    print(
        "Retrieved chunks supplied to Groq:",
        len(relevant_chunks or [])
    )
    print(
        "Context characters:",
        len(context)
    )
    print("=" * 60)

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=GROQ_TEMPERATURE,
            max_completion_tokens=GROQ_MAX_OUTPUT_TOKENS,
        )

    except Exception as exc:
        print(
            "[GROQ] Generation failed:",
            str(exc)
        )

        raise RuntimeError(
            f"Groq generation failed: {str(exc)}"
        ) from exc

    try:
        answer = (
            response
            .choices[0]
            .message
            .content
        )

    except Exception as exc:
        print(
            "[GROQ] Response parsing failed:",
            str(exc)
        )

        raise RuntimeError(
            "Groq returned an unexpected response."
        ) from exc

    answer = clean_answer(
        answer or ""
    )

    if not answer:
        raise RuntimeError(
            "Groq generated an empty answer."
        )

    print(
        "[GROQ] Answer generated successfully."
    )
    print(
        "[GROQ] Answer characters:",
        len(answer)
    )

    return answer