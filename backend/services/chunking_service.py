"""Convert Firecrawl Markdown into logical RAG chunks."""

import re
from typing import Dict, List


DEFAULT_MAX_CHARS = 3500


def normalize_text(text: str) -> str:
    """Normalize line endings and excessive blank lines."""

    if not text:
        return ""

    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    return text.strip()


def clean_chunk_text(text: str) -> str:
    """Clean chunk whitespace while preserving Markdown structure."""

    if not text:
        return ""

    text = normalize_text(text)

    text = re.sub(
        r"[ \t]{3,}",
        " ",
        text
    )

    return text.strip()


def split_into_sections(markdown: str) -> List[Dict]:
    """
    Split Markdown into logical sections.

    Each Markdown heading starts a new section and the heading
    is preserved separately as metadata.
    """

    markdown = normalize_text(markdown)

    if not markdown:
        return []

    lines = markdown.split("\n")

    sections: List[Dict] = []

    current_heading = ""
    current_level = 0
    current_lines: List[str] = []

    heading_pattern = re.compile(
        r"^(#{1,6})[ \t]+(.+?)\s*$"
    )

    def flush_section() -> None:
        nonlocal current_lines

        content = clean_chunk_text(
            "\n".join(current_lines)
        )

        if content:
            sections.append(
                {
                    "heading": current_heading,
                    "level": current_level,
                    "content": content,
                }
            )

        current_lines = []

    for line in lines:

        stripped = line.strip()

        match = heading_pattern.match(
            stripped
        )

        if match:

            flush_section()

            current_level = len(
                match.group(1)
            )

            current_heading = (
                match.group(2).strip()
            )

        else:

            current_lines.append(
                line
            )

    flush_section()

    return sections


SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+")

OVERLAP_CHARS = 200


def _split_oversized_paragraph(
    paragraph: str,
    max_chars: int
) -> List[str]:
    """Fall back to sentence boundaries when a single paragraph is too large."""

    if len(paragraph) <= max_chars:
        return [paragraph]

    sentences = [
        sentence.strip()
        for sentence in SENTENCE_SPLIT_PATTERN.split(paragraph)
        if sentence.strip()
    ]

    if len(sentences) <= 1:
        return [paragraph]

    return sentences


def _tail_overlap(
    text: str,
    overlap_chars: int = OVERLAP_CHARS
) -> str:
    """Return a trailing slice of text, snapped to the last sentence boundary."""

    if not text or len(text) <= overlap_chars:
        return ""

    tail = text[-overlap_chars:]

    boundary = re.search(r"[.!?]\s+", tail)

    if boundary:
        tail = tail[boundary.end():]

    return tail.strip()


def split_long_section(
    section: Dict,
    max_chars: int = DEFAULT_MAX_CHARS
) -> List[Dict]:
    """
    Split an oversized section by paragraph boundaries, falling back to
    sentence boundaries for oversized paragraphs, with controlled overlap
    carried forward between resulting parts.

    The section heading is preserved for every resulting part.
    """

    heading = (
        section.get("heading")
        or ""
    ).strip()

    level = int(
        section.get(
            "level",
            0
        )
    )

    content = (
        section.get("content")
        or ""
    ).strip()

    if not content:
        return []

    section_text = (
        f"# {heading}\n\n{content}"
        if heading
        else content
    )

    if len(section_text) <= max_chars:

        return [
            {
                "heading": heading,
                "level": level,
                "content": section_text,
            }
        ]

    raw_paragraphs = [
        paragraph.strip()
        for paragraph in re.split(
            r"\n\s*\n",
            content
        )
        if paragraph.strip()
    ]

    paragraphs: List[str] = []

    for paragraph in raw_paragraphs:
        paragraphs.extend(
            _split_oversized_paragraph(paragraph, max_chars)
        )

    raw_contents: List[str] = []

    current_content = ""

    for paragraph in paragraphs:

        candidate = (
            paragraph
            if not current_content
            else f"{current_content}\n\n{paragraph}"
        )

        candidate_text = (
            f"# {heading}\n\n{candidate}"
            if heading
            else candidate
        )

        if len(candidate_text) <= max_chars:

            current_content = candidate

            continue

        if current_content:
            raw_contents.append(current_content)

        current_content = paragraph

    if current_content:
        raw_contents.append(current_content)

    chunks: List[Dict] = []

    for index, raw_content in enumerate(raw_contents):

        # Carry the tail of the previous part forward for continuity.
        if index > 0:

            overlap = _tail_overlap(raw_contents[index - 1])

            if overlap and not raw_content.startswith(overlap):
                raw_content = f"{overlap}\n\n{raw_content}"

        current_text = (
            f"# {heading}\n\n{raw_content}"
            if heading
            else raw_content
        )

        chunks.append(
            {
                "heading": heading,
                "level": level,
                "content": current_text,
            }
        )

    return chunks


def chunk_markdown(
    markdown: str,
    source_url: str = "",
    title: str = "",
    max_chars: int = DEFAULT_MAX_CHARS
) -> List[Dict]:
    """
    Convert Firecrawl Markdown into RAG-ready chunks.

    Pipeline:

        Markdown
            ↓
        Normalize
            ↓
        Heading-based sections
            ↓
        Split oversized sections
            ↓
        Helix chunk objects
    """

    if not markdown:
        return []

    markdown = normalize_text(
        markdown
    )

    if not markdown:
        return []

    sections = split_into_sections(
        markdown
    )

    # Handle Markdown without headings.
    if not sections:

        cleaned = clean_chunk_text(
            markdown
        )

        if not cleaned:
            return []

        sections = [
            {
                "heading": title or "Main Content",
                "level": 1,
                "content": cleaned,
            }
        ]

    chunks: List[Dict] = []

    for section in sections:

        parts = split_long_section(
            section,
            max_chars=max_chars
        )

        for part in parts:

            text = clean_chunk_text(
                part.get(
                    "content",
                    ""
                )
            )

            if not text:
                continue

            chunks.append(
                {
                    "id": len(chunks),
                    "text": text,
                    "heading": part.get(
                        "heading",
                        ""
                    ),
                    "level": part.get(
                        "level",
                        0
                    ),
                    "source_url": source_url,
                    "title": title,
                    "chunk_index": len(chunks),
                }
            )

    return chunks