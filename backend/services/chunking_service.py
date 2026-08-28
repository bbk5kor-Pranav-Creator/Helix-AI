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


def split_long_section(
    section: Dict,
    max_chars: int = DEFAULT_MAX_CHARS
) -> List[Dict]:
    """
    Split an oversized section by paragraph boundaries.

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

    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(
            r"\n\s*\n",
            content
        )
        if paragraph.strip()
    ]

    chunks: List[Dict] = []

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

            current_text = (
                f"# {heading}\n\n{current_content}"
                if heading
                else current_content
            )

            chunks.append(
                {
                    "heading": heading,
                    "level": level,
                    "content": current_text,
                }
            )

        current_content = paragraph

    if current_content:

        current_text = (
            f"# {heading}\n\n{current_content}"
            if heading
            else current_content
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