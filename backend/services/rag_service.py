"""Helix AI local relevance retrieval for website chunks."""

import math
import os
import re
from collections import Counter
from typing import Dict, List

from dotenv import load_dotenv

load_dotenv()

DEFAULT_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
MIN_RELEVANCE_SCORE = float(os.getenv("RAG_MIN_RELEVANCE_SCORE", "0.02"))

_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "have", "how", "i", "in", "is", "it", "its", "of", "on",
    "or", "that", "the", "this", "to", "was", "what", "when", "where",
    "which", "who", "why", "with", "you", "your", "about", "can", "do",
    "does", "describe", "explain", "tell", "me"
}

_TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+(?:['-][a-zA-Z0-9]+)*")


def _tokenize(text: str) -> List[str]:
    """Normalize text into meaningful searchable tokens."""
    tokens = _TOKEN_PATTERN.findall((text or "").lower())
    return [token for token in tokens if token not in _STOP_WORDS and len(token) > 1]


def _term_frequency(tokens: List[str]) -> Counter:
    """Create normalized term frequencies."""
    counts = Counter(tokens)
    total = len(tokens)

    if not total:
        return Counter()

    return Counter({
        token: count / total
        for token, count in counts.items()
    })


def _score_chunk(chunk: Dict, question_tokens: List[str], question_counts: Counter) -> float:
    """Calculate local relevance between a question and one chunk."""
    text = (chunk.get("text") or "").strip()
    if not text:
        return 0.0

    chunk_tokens = _tokenize(text)
    if not chunk_tokens:
        return 0.0

    chunk_counts = Counter(chunk_tokens)
    chunk_tf = _term_frequency(chunk_tokens)

    unique_question_terms = set(question_tokens)
    unique_chunk_terms = set(chunk_tokens)

    overlap = unique_question_terms & unique_chunk_terms
    if not overlap:
        return 0.0

    overlap_score = len(overlap) / max(len(unique_question_terms), 1)

    weighted_overlap = sum(
        question_counts[token] * chunk_tf.get(token, 0.0)
        for token in overlap
    )

    phrase_score = 0.0
    question_text = " ".join(question_tokens)
    normalized_text = " ".join(chunk_tokens)

    if len(question_tokens) >= 2 and question_text in normalized_text:
        phrase_score = 0.25

    heading_score = 0.0
    heading = (chunk.get("heading") or "").strip()
    if heading:
        heading_tokens = set(_tokenize(heading))
        heading_overlap = unique_question_terms & heading_tokens
        if heading_overlap:
            heading_score = 0.15 * (
                len(heading_overlap) / max(len(unique_question_terms), 1)
            )

    position_score = 0.0
    if chunk.get("chunk_index") == 0:
        position_score = 0.01

    score = (
        (overlap_score * 0.55)
        + (weighted_overlap * 0.35)
        + phrase_score
        + heading_score
        + position_score
    )

    return min(float(score), 1.0)


def retrieve_relevant_chunks(
    chunks: List[Dict],
    question: str,
    top_k: int = DEFAULT_TOP_K
) -> List[Dict]:
    """
    Retrieve the most relevant website chunks using local lexical matching.

    No external embedding or retrieval API is used.
    """
    if not chunks:
        return []

    question = (question or "").strip()
    if not question:
        raise ValueError("A question is required for retrieval.")

    question_tokens = _tokenize(question)
    if not question_tokens:
        raise ValueError("The question does not contain searchable terms.")

    question_counts = _term_frequency(question_tokens)
    valid_chunks = []

    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue

        text = (chunk.get("text") or "").strip()
        if not text:
            continue

        score = _score_chunk(
            chunk,
            question_tokens,
            question_counts
        )

        item = dict(chunk)
        item["similarity"] = round(score, 6)
        item["retrieval_score"] = round(score, 6)

        valid_chunks.append(item)

    valid_chunks.sort(
        key=lambda item: item["retrieval_score"],
        reverse=True
    )

    top_k = max(1, int(top_k))

    selected = [
        chunk
        for chunk in valid_chunks[:top_k]
        if chunk["retrieval_score"] >= MIN_RELEVANCE_SCORE
    ]

    print(
        "[RAG] Retrieved",
        len(selected),
        "relevant chunks from",
        len(valid_chunks),
        "available chunks."
    )

    for item in selected:
        print(
            "[RAG]",
            "chunk_index=",
            item.get("chunk_index"),
            "score=",
            item.get("retrieval_score")
        )

    return selected


def close_rag_client():
    """Compatibility function; no external RAG client is used."""
    return None