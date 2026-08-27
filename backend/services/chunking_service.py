"""
Chunking service for Helix AI URL analysis.

Takes Markdown returned by Firecrawl and converts it into
logical chunks suitable for later RAG retrieval.
"""

import re
from typing import List, Dict


# =========================================================
# Configuration
# =========================================================

# Approximate target size for each chunk.
TARGET_CHUNK_SIZE = 1200

# Prevent a single chunk from becoming excessively large.
MAX_CHUNK_SIZE = 1800

# Small overlap helps preserve context between adjacent chunks.
CHUNK_OVERLAP = 150


# =========================================================
# Text Helpers
# =========================================================

def normalize_text(text: str) -> str:
    """Normalize excessive whitespace without destroying Markdown."""

    if not text:
        return ""

    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    # Remove trailing whitespace from lines.
    lines = [
        line.rstrip()
        for line in text.split("\n")
    ]

    # Collapse excessive blank lines.
    cleaned_lines = []

    previous_blank = False

    for line in lines:

        if not line.strip():

            if previous_blank:
                continue

            previous_blank = True
            cleaned_lines.append("")

        else:

            previous_blank = False
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def clean_chunk_text(text: str) -> str:
    """Clean a chunk while preserving useful Markdown structure."""

    if not text:
        return ""

    text = normalize_text(text)

    # Remove excessive spaces.
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text.strip()


# =========================================================
# Markdown Sections
# =========================================================

def split_into_sections(markdown: str) -> List[Dict]:
    """
    Split Markdown into logical sections based on headings.

    Each section keeps its heading and body together.
    """

    markdown = normalize_text(markdown)

    if not markdown:
        return []

    lines = markdown.split("\n")

    sections = []

    current_heading = ""
    current_level = 0
    current_lines = []

    heading_pattern = re.compile(
        r"^(#{1,6})\s+(.+?)\s*$"
    )

    def flush_section():

        nonlocal current_lines

        body = clean_chunk_text(
            "\n".join(current_lines)
        )

        if body:

            sections.append(
                {
                    "heading": current_heading,
                    "level": current_level,
                    "content": body,
                }
            )

        current_lines = []

    for line in lines:

        match = heading_pattern.match(line.strip())

        if match:

            flush_section()

            current_level = len(match.group(1))
            current_heading = match.group(2).strip()

        else:

            current_lines.append(line)

    flush_section()

    return sections


# =========================================================
# Long Section Splitting
# =========================================================

def split_long_text(
    text: str,
    max_size: int = MAX_CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[str]:
    """
    Split an oversized section while attempting to preserve
    paragraph and sentence boundaries.
    """

    text = clean_chunk_text(text)

    if len(text) <= max_size:
        return [text]

    paragraphs = [
        p.strip()
        for p in re.split(r"\n{2,}", text)
        if p.strip()
    ]

    chunks = []
    current = ""

    for paragraph in paragraphs:

        candidate = (
            paragraph
            if not current
            else current + "\n\n" + paragraph
        )

        if len(candidate) <= max_size:

            current = candidate
            continue

        if current:

            chunks.append(current)

        # If one paragraph itself is too large,
        # split it around sentence boundaries.
        if len(paragraph) > max_size:

            sentences = re.split(
                r"(?<=[.!?])\s+",
                paragraph
            )

            sentence_chunk = ""

            for sentence in sentences:

                candidate_sentence = (
                    sentence
                    if not sentence_chunk
                    else sentence_chunk
                    + " "
                    + sentence
                )

                if len(candidate_sentence) <= max_size:

                    sentence_chunk = candidate_sentence

                else:

                    if sentence_chunk:
                        chunks.append(
                            sentence_chunk.strip()
                        )

                    sentence_chunk = sentence

            if sentence_chunk:
                current = sentence_chunk.strip()

            else:
                current = ""

        else:

            current = paragraph

    if current:
        chunks.append(current)

    # Add small overlap between chunks where possible.
    if overlap <= 0 or len(chunks) <= 1:
        return chunks

    overlapped = []

    for index, chunk in enumerate(chunks):

        if index == 0:

            overlapped.append(chunk)
            continue

        previous = chunks[index - 1]

        overlap_text = previous[-overlap:]

        combined = (
            overlap_text
            + "\n\n"
            + chunk
        )

        # Do not allow overlap to make a chunk
        # exceed our maximum limit.
        if len(combined) <= max_size + overlap:

            overlapped.append(combined)

        else:

            overlapped.append(chunk)

    return overlapped


# =========================================================
# Build Chunks
# =========================================================

def chunk_markdown(
    markdown: str,
    source_url: str = "",
    title: str = "",
) -> List[Dict]:
    """
    Convert Firecrawl Markdown into RAG-ready chunks.

    Each chunk contains:

        id
        text
        heading
        level
        source_url
        title
        chunk_index
    """

    sections = split_into_sections(markdown)

    if not sections:

        cleaned = clean_chunk_text(markdown)

        if not cleaned:
            return []

        sections = [
            {
                "heading": title or "Main Content",
                "level": 1,
                "content": cleaned,
            }
        ]

    chunks = []

    for section in sections:

        heading = section["heading"]
        level = section["level"]
        content = section["content"]

        if heading:

            section_text = (
                f"# {heading}\n\n"
                f"{content}"
            )

        else:

            section_text = content

        parts = split_long_text(
            section_text
        )

        for part in parts:

            part = clean_chunk_text(part)

            if not part:
                continue

            chunks.append(
                {
                    "id": len(chunks),
                    "text": part,
                    "heading": heading,
                    "level": level,
                    "source_url": source_url,
                    "title": title,
                    "chunk_index": len(chunks),
                }
            )

    return chunks