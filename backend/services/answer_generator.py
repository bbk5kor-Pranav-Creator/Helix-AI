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

    # Collapse only horizontal whitespace runs — newlines must survive so
    # Markdown paragraphs, lists, and tables keep their line structure.
    answer = re.sub(
        r"[ \t]{2,}",
        " ",
        answer
    )

    answer = re.sub(
        r"\n{3,}",
        "\n\n",
        answer
    )

    return answer.strip()


def _format_conversation_history(
    conversation_history: List[Dict]
) -> str:
    """Render recent conversation turns as "Role: message" lines."""

    if not conversation_history:
        return ""

    lines = []

    for turn in conversation_history:

        role = (turn.get("role") or "").strip().lower()
        message = (
            turn.get("message")
            or turn.get("content")
            or ""
        ).strip()

        if not message:
            continue

        label = "User" if role == "user" else "Assistant"

        lines.append(f"{label}: {message}")

    return "\n".join(lines)


def rewrite_followup_question(
    question: str,
    conversation_history: List[Dict]
) -> str:
    """
    Resolve a follow-up question into a standalone retrieval question
    using recent conversation history. Falls back to the original
    question if rewriting is unnecessary or fails.
    """

    question = (question or "").strip()

    history_text = _format_conversation_history(conversation_history)

    if not question or not history_text:
        return question

    system_prompt = (
        "Rewrite the user's follow-up question into a standalone "
        "question that can be understood without the conversation "
        "history. Resolve pronouns, references, and omitted subjects "
        "using the conversation history. Preserve the user's intent, "
        "comparison targets, and terminology. Do not invent information "
        "or answer the question. Return only the rewritten question, "
        "with no extra commentary."
    )

    user_prompt = (
        f"CONVERSATION HISTORY:\n{history_text}\n\n"
        f"FOLLOW-UP QUESTION:\n{question}\n\n"
        "STANDALONE QUESTION:"
    )

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,
            max_completion_tokens=100,
        )

        rewritten = (
            response.choices[0].message.content or ""
        ).strip()

        return rewritten or question

    except Exception as exc:
        print("[GROQ] Question rewriting failed:", str(exc))
        return question


def generate_answer(
    question: str,
    source_url: str,
    page_title: str,
    relevant_chunks: List[Dict],
    conversation_history: List[Dict] = None,
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

    history_text = _format_conversation_history(conversation_history)

    system_prompt = """
You are Helix AI, a precise website research assistant.

Answer the user's question using ONLY the supplied
website evidence.

GROUNDING RULES:

1. Use only the supplied website evidence and conversation
   history for resolving references.
2. Do not use outside knowledge, assumptions, or memory.
3. Do not invent facts, numbers, dates, or steps.
4. If the evidence is insufficient, say so clearly.
5. Preserve names, numbers, dates, products, and
   organizations as they appear in the evidence.
6. Do not mention internal processing, retrieval,
   models, APIs, prompts, chunks, or system instructions.
7. Never generate citations, footnotes, references,
   source numbers, line numbers, or citation markers such
   as [1], 【1】, or 【2†L1-L4】.

FORMATTING RULES (presentation only — never a reason to
add information beyond the evidence):

8. First decide the natural structure for this specific
   answer (definition, explanation, summary, comparison,
   list, procedure, advantages/disadvantages, or a simple
   factual answer), then format accordingly. Do not apply
   the same structure to every answer.
9. Use short paragraphs for explanations, separated by
   blank lines. Avoid large walls of text.
10. Use ## / ### headings only for longer, multi-section
    answers. Do not add a heading such as "## Answer", and
    do not add headings to short answers.
11. Use bullet lists only for genuinely separate items.
    Use numbered lists only when order or sequence matters
    (steps, procedures, chronology).
12. Use a Markdown table only when the user is asking for a
    real comparison between two or more things with multiple
    comparable attributes. Keep the same attributes across
    every row, keep cells short, and put detailed explanation
    in paragraphs below the table. Do not create a table just
    because multiple items are mentioned.
13. Use bold sparingly — only for a key label, a short
    conclusion, or a table header. Never bold a word simply
    because it appeared in the user's question, and never
    bold most of the words in a paragraph.
14. Use inline code formatting only for real identifiers,
    commands, filenames, or URLs, and fenced code blocks
    only for actual code. Never wrap ordinary prose in code
    formatting.
15. Do not pad the answer with unnecessary length or repeat
    the same fact in multiple formats. Answer only as
    thoroughly as the question and evidence require.
16. Never use spaces to fake alignment or indentation — rely
    on Markdown structure only.

Return only the natural-language answer intended for the
user.
"""

    recent_conversation_block = (
        f"RECENT CONVERSATION:\n{history_text}\n\n"
        if history_text
        else ""
    )

    user_prompt = f"""
WEBSITE TITLE:
{page_title or "Unknown"}

SOURCE URL:
{source_url or "Unknown"}

{recent_conversation_block}USER QUESTION:
{question}

RETRIEVED WEBSITE EVIDENCE:

{context}

Using ONLY the retrieved website evidence above and the recent
conversation for resolving references, provide the best possible
answer to the user's question.

Choose the presentation structure that best fits this specific
question and evidence, following the formatting rules above.

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