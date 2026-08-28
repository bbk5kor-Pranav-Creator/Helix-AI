"""Clean Firecrawl Markdown for Helix AI RAG processing."""

import re


# =========================================================
# Markdown Cleaning
# =========================================================

def clean_markdown(text: str) -> str:
    """
    Remove common web noise while preserving useful content.

    This follows the WebLens cleaning strategy.
    """

    if not text:
        return ""

    # -----------------------------------------------------
    # Normalize line endings
    # -----------------------------------------------------

    text = text.replace(
        "\r\n",
        "\n"
    )

    text = text.replace(
        "\r",
        "\n"
    )

    # -----------------------------------------------------
    # Remove HTML comments
    # -----------------------------------------------------

    text = re.sub(
        r"<!--.*?-->",
        "",
        text,
        flags=re.DOTALL
    )

    # -----------------------------------------------------
    # Remove script/style/noscript blocks when present
    # -----------------------------------------------------

    text = re.sub(
        r"<(script|style|noscript)\b[^>]*>.*?</\1>",
        "",
        text,
        flags=re.DOTALL | re.IGNORECASE
    )

    # -----------------------------------------------------
    # Remove common navigation/footer noise
    # -----------------------------------------------------

    noise_patterns = [
        r"(?im)^.*?(?:skip to content|skip navigation).*$",
        r"(?im)^.*?(?:sign in|log in|login).*$",
        r"(?im)^.*?(?:subscribe|newsletter).*$",
        r"(?im)^.*?(?:cookie policy|privacy policy).*$",
        r"(?im)^.*?(?:accept cookies|manage cookies).*$",
    ]

    for pattern in noise_patterns:

        text = re.sub(
            pattern,
            "",
            text
        )

    # -----------------------------------------------------
    # Remove excessive blank lines
    # -----------------------------------------------------

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    # -----------------------------------------------------
    # Remove excessive spaces
    # -----------------------------------------------------

    text = re.sub(
        r"[ \t]{3,}",
        " ",
        text
    )

    return text.strip()