"""TF-IDF relevance retrieval for Helix AI RAG processing."""

from typing import Dict, List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# =========================================================
# Configuration
# =========================================================

DEFAULT_TOP_K = 5


# =========================================================
# Retrieve Relevant Chunks
# =========================================================

def retrieve_relevant_chunks(
    chunks: List[Dict],
    question: str,
    top_k: int = DEFAULT_TOP_K
) -> List[Dict]:
    """
    Rank document chunks against the question using local
    TF-IDF vectorization and cosine similarity.

    Stop words are handled by the vectorizer so generic
    question terms do not dominate relevance.
    """

    if not chunks:
        return []

    question = (
        question or ""
    ).strip()

    if not question:
        raise ValueError(
            "A question is required for retrieval."
        )

    # -----------------------------------------------------
    # Ignore empty chunks
    # -----------------------------------------------------

    usable_chunks = [
        chunk
        for chunk in chunks
        if isinstance(chunk, dict)
        and (
            chunk.get("text")
            or chunk.get("content")
            or ""
        ).strip()
    ]

    if not usable_chunks:
        return []

    documents = [
        (
            chunk.get("text")
            or chunk.get("content")
            or ""
        ).strip()
        for chunk in usable_chunks
    ]

    # -----------------------------------------------------
    # TF-IDF + cosine similarity scoring
    # -----------------------------------------------------

    try:
        vectorizer = TfidfVectorizer(
            stop_words="english"
        )

        matrix = vectorizer.fit_transform(
            documents + [question]
        )

        scores = cosine_similarity(
            matrix[-1],
            matrix[:-1]
        )[0]

    except ValueError:
        # Empty vocabulary after stop-word removal.
        scores = [0.0] * len(usable_chunks)

    # -----------------------------------------------------
    # Rank highest relevance first
    # -----------------------------------------------------

    ranked = sorted(
        zip(usable_chunks, scores),
        key=lambda item: item[1],
        reverse=True
    )

    top_k = max(
        1,
        int(top_k)
    )

    selected = ranked[:top_k]

    # -----------------------------------------------------
    # Build result objects, preserving chunk metadata
    # -----------------------------------------------------

    results = []

    for index, (chunk, score) in enumerate(selected):

        score = float(score)

        results.append(
            {
                "id": index,
                "text": (
                    chunk.get("text")
                    or chunk.get("content")
                    or ""
                ).strip(),
                "heading": (
                    chunk.get("heading")
                    or "General Content"
                ),
                "level": chunk.get(
                    "level",
                    1
                ),
                "source_url": chunk.get(
                    "source_url",
                    ""
                ),
                "title": chunk.get(
                    "title",
                    ""
                ),
                "chunk_index": chunk.get(
                    "chunk_index",
                    index
                ),
                "similarity": round(
                    score,
                    6
                ),
                "retrieval_score": round(
                    score,
                    6
                )
            }
        )

    # -----------------------------------------------------
    # Logging
    # -----------------------------------------------------

    print(
        "[RAG] Question:",
        question
    )

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
            "chunk_index=",
            item.get("chunk_index"),
            "heading=",
            item.get("heading"),
            "score=",
            item.get(
                "retrieval_score"
            )
        )

    return results


# =========================================================
# Compatibility
# =========================================================

def close_rag_client():
    """
    WebLens retrieval is local and has no external client.
    """

    return None