"""Hybrid BM25 + lexical/coverage retrieval for Helix AI RAG processing."""

import math
import re
from collections import Counter, defaultdict
from typing import Dict, List

from services.context_builder import is_structural_noise


# =========================================================
# Configuration
# =========================================================

DEFAULT_TOP_K = 5
DEFAULT_CANDIDATE_K = 12

BM25_K1 = 1.5
BM25_B = 0.75
RRF_K = 60
PHRASE_MATCH_BONUS = 0.4
HEADING_OVERLAP_WEIGHT = 0.5
STRUCTURAL_NOISE_PENALTY = 0.4


# =========================================================
# Tokenization
# =========================================================

TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:['\-][a-z0-9]+)+|[a-z0-9]+")

# Standard English stop words, kept in-house to avoid an extra dependency.
STOP_WORDS = frozenset({
    "a", "about", "above", "after", "again", "against", "all", "am", "an",
    "and", "any", "are", "aren't", "as", "at", "be", "because", "been",
    "before", "being", "below", "between", "both", "but", "by", "can",
    "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from",
    "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having",
    "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers",
    "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its",
    "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
    "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't",
    "so", "some", "such", "than", "that", "that's", "the", "their",
    "theirs", "them", "themselves", "then", "there", "there's", "these",
    "they", "they'd", "they'll", "they're", "they've", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't",
    "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves",
})


def tokenize(text: str, keep_stopwords: bool = False) -> List[str]:
    """Normalize text into words/numbers/hyphenated/apostrophe terms."""

    if not text:
        return []

    tokens = TOKEN_PATTERN.findall(text.lower())

    if keep_stopwords:
        return tokens

    return [token for token in tokens if token not in STOP_WORDS]


# =========================================================
# Compound Question Decomposition
# =========================================================

_WH_LEAD = (
    r"what|how|why|when|where|which|who|is|are|does|do|can|will|should|"
    r"could|would"
)

_COMPOUND_SPLIT_PATTERN = re.compile(
    r"\?\s+"
    r"|,?\s+and\s+(?=(?:" + _WH_LEAD + r")\b)"
    r"|,\s+(?=(?:" + _WH_LEAD + r")\b)",
    re.IGNORECASE
)


def decompose_question(question: str) -> List[str]:
    """Split a compound question into separate information requirements."""

    question = (question or "").strip()

    if not question:
        return []

    parts = [
        part.strip(" ?").strip()
        for part in _COMPOUND_SPLIT_PATTERN.split(question)
        if part and part.strip(" ?").strip()
    ]

    if len(parts) <= 1:
        return [question]

    return parts


# =========================================================
# BM25
# =========================================================

def _bm25_scores(
    doc_tokens: List[List[str]],
    query_tokens: List[str]
) -> List[float]:
    """Score documents against a query using Okapi BM25."""

    n_docs = len(doc_tokens)

    if n_docs == 0 or not query_tokens:
        return [0.0] * n_docs

    doc_lengths = [len(tokens) for tokens in doc_tokens]

    avg_doc_length = (
        sum(doc_lengths) / n_docs
        if n_docs
        else 0.0
    )

    doc_freq = Counter()

    for tokens in doc_tokens:
        for term in set(tokens):
            doc_freq[term] += 1

    idf = {}

    for term in set(query_tokens):

        df = doc_freq.get(term, 0)

        idf[term] = math.log(
            ((n_docs - df + 0.5) / (df + 0.5)) + 1
        )

    scores = []

    for tokens, doc_len in zip(doc_tokens, doc_lengths):

        term_freq = Counter(tokens)

        score = 0.0

        for term in query_tokens:

            tf = term_freq.get(term, 0)

            if tf == 0:
                continue

            length_norm = (
                doc_len / avg_doc_length
                if avg_doc_length
                else 0.0
            )

            denom = tf + BM25_K1 * (
                1 - BM25_B + BM25_B * length_norm
            )

            score += idf.get(term, 0.0) * (tf * (BM25_K1 + 1)) / denom

        scores.append(score)

    return scores


# =========================================================
# Lexical / Coverage Scoring
# =========================================================

def _lexical_score(
    query_tokens: List[str],
    query_text_lower: str,
    doc_tokens: List[str],
    doc_text_lower: str,
    heading: str
) -> float:
    """Score a document's lexical overlap/coverage against a query."""

    query_set = set(query_tokens)

    if not query_set:
        return 0.0

    doc_set = set(doc_tokens)

    overlap = len(query_set & doc_set) / len(query_set)

    heading_tokens = set(tokenize(heading))

    heading_overlap = (
        len(query_set & heading_tokens) / len(query_set)
        if heading_tokens
        else 0.0
    )

    phrase_bonus = (
        PHRASE_MATCH_BONUS
        if query_text_lower and query_text_lower in doc_text_lower
        else 0.0
    )

    score = overlap + HEADING_OVERLAP_WEIGHT * heading_overlap + phrase_bonus

    if is_structural_noise(heading):
        score *= STRUCTURAL_NOISE_PENALTY

    return score


# =========================================================
# Reciprocal Rank Fusion
# =========================================================

def _reciprocal_rank_fusion(
    rankings: List[List[int]],
    k: int = RRF_K
) -> Dict[int, float]:
    """Combine multiple rankings (best-to-worst index lists) via RRF."""

    fused: Dict[int, float] = defaultdict(float)

    for ranking in rankings:
        for rank, index in enumerate(ranking):
            fused[index] += 1.0 / (k + rank + 1)

    return fused


# =========================================================
# Retrieve Relevant Chunks
# =========================================================

def retrieve_relevant_chunks(
    chunks: List[Dict],
    question: str,
    top_k: int = DEFAULT_TOP_K,
    candidate_k: int = DEFAULT_CANDIDATE_K
) -> List[Dict]:
    """
    Rank document chunks against the question using hybrid retrieval:

        BM25 + lexical/coverage scoring
            -> Reciprocal Rank Fusion
            -> candidate pool
            -> compound-question coverage
            -> top_k
    """

    if not chunks:
        return []

    question = (question or "").strip()

    if not question:
        raise ValueError("A question is required for retrieval.")

    # -----------------------------------------------------
    # Ignore empty chunks
    # -----------------------------------------------------

    usable_chunks = [
        chunk
        for chunk in chunks
        if isinstance(chunk, dict)
        and (chunk.get("text") or chunk.get("content") or "").strip()
    ]

    if not usable_chunks:
        return []

    documents = [
        (chunk.get("text") or chunk.get("content") or "").strip()
        for chunk in usable_chunks
    ]

    headings = [chunk.get("heading") or "" for chunk in usable_chunks]

    doc_tokens = [tokenize(text) for text in documents]
    doc_texts_lower = [text.lower() for text in documents]

    query_tokens = tokenize(question)

    # Fall back to raw words if the question is entirely stop words.
    if not query_tokens:
        query_tokens = tokenize(question, keep_stopwords=True)

    query_text_lower = question.lower()

    top_k = max(1, int(top_k))
    candidate_k = max(top_k, min(int(candidate_k), len(usable_chunks)))

    # -----------------------------------------------------
    # BM25 ranking
    # -----------------------------------------------------

    bm25_scores = _bm25_scores(doc_tokens, query_tokens)

    bm25_ranking = sorted(
        range(len(usable_chunks)),
        key=lambda i: bm25_scores[i],
        reverse=True
    )

    # -----------------------------------------------------
    # Lexical / coverage ranking
    # -----------------------------------------------------

    lexical_scores = [
        _lexical_score(
            query_tokens,
            query_text_lower,
            doc_tokens[i],
            doc_texts_lower[i],
            headings[i]
        )
        for i in range(len(usable_chunks))
    ]

    lexical_ranking = sorted(
        range(len(usable_chunks)),
        key=lambda i: lexical_scores[i],
        reverse=True
    )

    # -----------------------------------------------------
    # Reciprocal Rank Fusion
    # -----------------------------------------------------

    fused = _reciprocal_rank_fusion([bm25_ranking, lexical_ranking])

    fused_ranking = sorted(
        range(len(usable_chunks)),
        key=lambda i: fused.get(i, 0.0),
        reverse=True
    )

    candidates = fused_ranking[:candidate_k]

    max_fused_score = max(
        (fused.get(i, 0.0) for i in candidates),
        default=0.0
    )

    # -----------------------------------------------------
    # Compound-question coverage
    # -----------------------------------------------------

    sub_questions = decompose_question(question)

    selected_indices: List[int] = []

    if len(sub_questions) > 1:

        for sub_question in sub_questions:

            sub_tokens = tokenize(sub_question)

            if not sub_tokens:
                continue

            best_index = None
            best_score = 0.0

            for index in candidates:

                if index in selected_indices:
                    continue

                score = _lexical_score(
                    sub_tokens,
                    sub_question.lower(),
                    doc_tokens[index],
                    doc_texts_lower[index],
                    headings[index]
                )

                if score > best_score:
                    best_score = score
                    best_index = index

            if best_index is not None:
                selected_indices.append(best_index)

            if len(selected_indices) >= top_k:
                break

        print(
            "[RAG] Compound question parts:", len(sub_questions),
            "- covered by", len(selected_indices), "chunks"
        )

    # Fill remaining slots using the strongest overall fused ranking.
    for index in candidates:

        if len(selected_indices) >= top_k:
            break

        if index not in selected_indices:
            selected_indices.append(index)

    # Present strongest-first regardless of coverage selection order.
    selected_indices = sorted(
        selected_indices[:top_k],
        key=lambda i: fused.get(i, 0.0),
        reverse=True
    )

    # -----------------------------------------------------
    # Build result objects, preserving chunk metadata
    # -----------------------------------------------------

    results = []

    for result_index, chunk_index in enumerate(selected_indices):

        chunk = usable_chunks[chunk_index]

        fused_score = fused.get(chunk_index, 0.0)

        normalized_score = (
            fused_score / max_fused_score
            if max_fused_score
            else 0.0
        )

        results.append(
            {
                "id": result_index,
                "text": documents[chunk_index],
                "heading": headings[chunk_index] or "General Content",
                "level": chunk.get("level", 1),
                "source_url": chunk.get("source_url", ""),
                "title": chunk.get("title", ""),
                "chunk_index": chunk.get("chunk_index", chunk_index),
                "similarity": round(normalized_score, 6),
                "retrieval_score": round(fused_score, 6)
            }
        )

    # -----------------------------------------------------
    # Logging
    # -----------------------------------------------------

    print("[RAG] Question:", question)
    print("[RAG] Candidate chunks:", len(candidates))

    print(
        "[RAG] Retrieved",
        len(results),
        "relevant chunks from",
        len(usable_chunks),
        "available chunks."
    )

    for item in results:
        print(
            "[RAG]",
            "chunk_index=", item.get("chunk_index"),
            "heading=", item.get("heading"),
            "score=", item.get("retrieval_score")
        )

    return results


# =========================================================
# Compatibility
# =========================================================

def close_rag_client():
    """
    Helix retrieval is local and has no external client.
    """

    return None
