"""Extract page-structured Markdown (text + tables) from PDF files using PyMuPDF."""

import os
from typing import Dict, List, Optional

import fitz  # PyMuPDF


def _escape_cell(value) -> str:
    """Render one table cell as safe Markdown text."""

    text = "" if value is None else str(value).strip()

    return text.replace("|", "\\|").replace("\n", " ")


def _table_to_markdown(rows: Optional[List[list]]) -> str:
    """Convert a PyMuPDF-extracted table (list of rows) into a Markdown pipe table."""

    if not rows or not rows[0]:
        return ""

    header = [_escape_cell(cell) for cell in rows[0]]
    col_count = len(header)

    if col_count == 0:
        return ""

    lines = [
        "| " + " | ".join(header) + " |",
        "|" + "|".join(["---"] * col_count) + "|",
    ]

    for row in rows[1:]:

        cells = [_escape_cell(cell) for cell in row]

        if len(cells) < col_count:
            cells = cells + [""] * (col_count - len(cells))
        elif len(cells) > col_count:
            cells = cells[:col_count]

        lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines)


def _extract_page_tables(page) -> List[str]:
    """Best-effort table extraction for one page; text extraction never depends on it."""

    try:
        finder = page.find_tables()
    except Exception:
        return []

    tables_markdown = []

    for table in getattr(finder, "tables", []):

        try:
            markdown_table = _table_to_markdown(table.extract())
        except Exception:
            continue

        if markdown_table:
            tables_markdown.append(markdown_table)

    return tables_markdown


def extract_pdf_content(path: str) -> Dict:
    """
    Parse a local PDF file into page-structured Markdown.

    Returns: {"title": str, "markdown": str, "page_count": int}
    Raises ValueError for password-protected, empty, or textless (scanned) PDFs.
    """

    try:
        doc = fitz.open(path)
    except Exception as exc:
        raise ValueError(f"Could not open this PDF file: {exc}")

    try:
        if doc.is_encrypted and not doc.authenticate(""):
            raise ValueError(
                "This PDF is password-protected and cannot be analyzed."
            )

        page_count = doc.page_count

        if page_count == 0:
            raise ValueError("This PDF has no pages.")

        metadata_title = ((doc.metadata or {}).get("title") or "").strip()

        page_blocks: List[str] = []
        first_text_line = ""

        for page_index in range(page_count):

            page = doc.load_page(page_index)
            page_text = (page.get_text("text") or "").strip()

            if not first_text_line:
                for line in page_text.splitlines():
                    if line.strip():
                        first_text_line = line.strip()
                        break

            section_parts = []

            if page_text:
                section_parts.append(page_text)

            section_parts.extend(_extract_page_tables(page))

            if not section_parts:
                continue

            page_blocks.append(
                f"## Page {page_index + 1}\n\n" + "\n\n".join(section_parts)
            )

        if not page_blocks:
            raise ValueError(
                "No extractable text was found in this PDF. It may be a "
                "scanned or image-only document."
            )

        title = (
            metadata_title
            or first_text_line
            or os.path.splitext(os.path.basename(path))[0]
        )

        return {
            "title": title[:200],
            "markdown": "\n\n".join(page_blocks),
            "page_count": page_count,
        }

    finally:
        doc.close()
