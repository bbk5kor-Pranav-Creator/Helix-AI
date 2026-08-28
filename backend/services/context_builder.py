"""WebLens-aligned context builder for Helix AI."""

import os
from typing import Dict, List


# =========================================================
# Configuration
# =========================================================

DEFAULT_MAX_CONTEXT = int(
    os.getenv(
        "RAG_MAX_CONTEXT_CHARS",
        "16000"
    )
)


# =========================================================
# Structural Noise
# =========================================================

STRUCTURAL_NOISE_HEADINGS = {
    "external links",
    "see also",
    "references",
    "notes",
    "further reading",
    "bibliography",
    "sources",
    "related articles",
    "navigation",
}


def normalize_heading(
    heading: str
) -> str:
    """
    Normalize a heading for structural comparison.
    """

    if not heading:
        return ""

    heading = heading.strip().lower()

    return heading


def is_structural_noise(
    heading: str
) -> bool:
    """
    Identify structural website sections that should not
    normally be supplied to the answer generator.
    """

    normalized = normalize_heading(
        heading
    )

    return (
        normalized
        in STRUCTURAL_NOISE_HEADINGS
    )


# =========================================================
# Context Builder
# =========================================================

def build_context(
    relevant_chunks: List[Dict],
    max_context_chars: int = DEFAULT_MAX_CONTEXT
) -> Dict:
    """
    Build a compact context from already-ranked Helix chunks.

    The retrieval/ranking stage is intentionally kept outside
    this service.

    Pipeline:

        Retrieved chunks
              ↓
        Structural filtering
              ↓
        Context size control
              ↓
        Final context
    """

    if not relevant_chunks:

        return {
            "success": False,
            "error": "No relevant content provided."
        }


    # -----------------------------------------------------
    # Structural filtering
    # -----------------------------------------------------

    usable_chunks = []

    for chunk in relevant_chunks:

        if not isinstance(
            chunk,
            dict
        ):
            continue

        heading = (
            chunk.get("heading")
            or ""
        ).strip()

        if is_structural_noise(
            heading
        ):
            continue

        text = (
            chunk.get("text")
            or chunk.get("content")
            or ""
        ).strip()

        if not text:
            continue

        usable_chunks.append(
            chunk
        )


    if not usable_chunks:

        return {
            "success": False,
            "error": "No usable relevant content found."
        }


    # -----------------------------------------------------
    # Context size control
    # -----------------------------------------------------

    selected = []

    current_context_length = 0

    for chunk in usable_chunks:

        heading = (
            chunk.get("heading")
            or ""
        ).strip()

        content = (
            chunk.get("text")
            or chunk.get("content")
            or ""
        ).strip()

        if heading:

            chunk_text = (
                f"## {heading}\n\n"
                f"{content}\n\n"
            )

        else:

            chunk_text = (
                f"{content}\n\n"
            )

        chunk_length = len(
            chunk_text
        )

        # Do not allow the context to exceed
        # the configured maximum.
        if (
            current_context_length
            + chunk_length
            > max_context_chars
        ):
            continue

        selected.append(
            {
                "score": chunk.get(
                    "retrieval_score",
                    chunk.get(
                        "similarity",
                        chunk.get(
                            "score",
                            0.0
                        )
                    )
                ),
                "heading": heading,
                "content": content,
                "source_url": (
                    chunk.get(
                        "source_url"
                    )
                    or ""
                ),
                "chunk_index": chunk.get(
                    "chunk_index"
                )
            }
        )

        current_context_length += (
            chunk_length
        )


    if not selected:

        return {
            "success": False,
            "error": (
                "Relevant chunks could not fit "
                "within the context limit."
            )
        }


    # -----------------------------------------------------
    # Build final context
    # -----------------------------------------------------

    context_parts = []

    for chunk in selected:

        heading = chunk[
            "heading"
        ]

        content = chunk[
            "content"
        ]

        if heading:

            context_parts.append(
                f"## {heading}\n\n"
                f"{content}"
            )

        else:

            context_parts.append(
                content
            )


    final_context = (
        "\n\n".join(
            context_parts
        )
    )


    # -----------------------------------------------------
    # Final result
    # -----------------------------------------------------

    return {
        "success": True,
        "chunks_selected": len(
            selected
        ),
        "context_length": len(
            final_context
        ),
        "selected_chunks": selected,
        "context": final_context
    }


# =========================================================
# Helix Compatibility Helper
# =========================================================

def build_rag_context(
    relevant_chunks: List[Dict],
    max_context_chars: int = DEFAULT_MAX_CONTEXT
) -> str:
    """
    Convenience wrapper used by answer generation.

    Returns only the final context string.
    """

    result = build_context(
        relevant_chunks=relevant_chunks,
        max_context_chars=max_context_chars
    )

    if not result.get(
        "success"
    ):
        return ""

    return result.get(
        "context",
        ""
    )