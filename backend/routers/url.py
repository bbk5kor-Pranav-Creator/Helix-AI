import os
import re
import difflib
from datetime import datetime
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel
from groq import Groq

from database import db


# =========================================================
# Configuration
# =========================================================

load_dotenv()

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Current Groq model available in the user's environment.
# Can be overridden from .env using GROQ_MODEL.
GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

groq_client = Groq(
    api_key=GROQ_API_KEY
)


# =========================================================
# Retrieval Configuration
# =========================================================

# Maximum number of internal pages that may actually be
# fetched when the primary page does not contain enough
# relevant information.
MAX_INTERNAL_PAGES = 3

# Maximum number of candidate links considered after
# cleaning/ranking.
MAX_CANDIDATE_LINKS = 100

# Maximum characters retained from the primary page.
# This is NOT automatically sent to Groq.
MAX_PRIMARY_CONTENT = 30000

# Maximum characters retained from an internal page.
MAX_INTERNAL_CONTENT = 18000

# Maximum final evidence sent to Groq.
# This keeps requests comfortably below the model's
# token-per-minute limit.
MAX_LLM_EVIDENCE = 24000

# Maximum generated answer.
MAX_OUTPUT_TOKENS = 900

REQUEST_TIMEOUT = 20

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


# =========================================================
# Request Model
# =========================================================

class URLRequest(BaseModel):
    url: str
    instruction: str = ""


# =========================================================
# General Helpers
# =========================================================

def normalize_text(text):
    if not text:
        return ""

    return " ".join(
        text.replace("\xa0", " ").split()
    )


def normalize_for_matching(text):
    """
    Normalize text for topic/heading comparison.

    Also handles simple spelling mistakes such as:

    abstarction -> abstraction
    """
    if not text:
        return ""

    text = text.lower()

    text = re.sub(
        r"[^a-z0-9\s]",
        " ",
        text
    )

    text = normalize_text(text)

    return text


def tokenize(text):
    text = normalize_for_matching(text)

    if not text:
        return []

    return [
        word
        for word in text.split()
        if len(word) > 1
    ]


def similarity(a, b):
    a = normalize_for_matching(a)
    b = normalize_for_matching(b)

    if not a or not b:
        return 0.0

    return difflib.SequenceMatcher(
        None,
        a,
        b
    ).ratio()


def keyword_overlap(text, keywords):
    """
    Returns a simple relevance score between 0 and 1.
    """
    if not text or not keywords:
        return 0.0

    text_tokens = set(
        tokenize(text)
    )

    keyword_tokens = set(
        tokenize(" ".join(keywords))
        if isinstance(keywords, (list, tuple))
        else tokenize(keywords)
    )

    if not keyword_tokens:
        return 0.0

    matches = (
        text_tokens.intersection(
            keyword_tokens
        )
    )

    return len(matches) / len(
        keyword_tokens
    )


def is_probably_html(content):
    """
    Detect whether retrieved content is HTML or already
    cleaned plain / markdown text (e.g. from Jina).
    """
    if not content:
        return False

    sample = content[:2000].lower().strip()

    html_signals = (
        "<html",
        "<!doctype",
        "<head",
        "<body",
        "<div",
        "<p>",
        "<article",
        "<main",
        "<section",
        "<h1",
        "<h2",
        "<title"
    )

    return any(sig in sample for sig in html_signals)


# =========================================================
# URL Normalization
# =========================================================

def normalize_url(url):
    url = (url or "").strip()

    if not url:
        return ""

    # Markdown link:
    # [label](https://example.com/path)
    markdown_match = re.search(
        r"\]\((https?://[^\s]+)\)",
        url
    )
    if markdown_match:
        candidate = markdown_match.group(1).rstrip(".,;")
        return candidate

    # Extract a full http(s) URL from the string.
    # Keep parentheses that belong to the path
    # (e.g. /wiki/Some_Page_(topic)).
    bare_match = re.search(
        r"(https?://[^\s<>\"']+)",
        url
    )
    if bare_match:
        url = bare_match.group(1)

    # Strip only matching outer wrappers, not path characters.
    url = url.strip()
    while len(url) >= 2 and (
        (url[0] == "<" and url[-1] == ">")
        or (url[0] == "[" and url[-1] == "]")
        or (url[0] == '"' and url[-1] == '"')
        or (url[0] == "'" and url[-1] == "'")
    ):
        url = url[1:-1].strip()

    # Trailing punctuation that is almost never part of a URL
    url = url.rstrip(".,;")

    # Add scheme if missing (user typed example.com)
    if url and not re.match(r"^https?://", url, re.I):
        url = "https://" + url

    return url

# =========================================================
# Challenge Page Detection
# =========================================================

def is_challenge_page(html):
    if not html:
        return True

    try:
        # Fast path for plain text / markdown (Jina)
        if not is_probably_html(html):
            combined = normalize_text(html).lower()
        else:
            soup = BeautifulSoup(
                html,
                "html.parser"
            )

            title = ""

            if soup.title:
                title = soup.title.get_text(
                    " ",
                    strip=True
                )

            page_text = soup.get_text(
                " ",
                strip=True
            )

            combined = normalize_text(
                title + " " + page_text
            ).lower()

        challenge_words = [
            "cloudflare",
            "security verification",
            "verify you are human",
            "verifying that you are human",
            "checking your browser",
            "checking if the site connection is secure",
            "security check",
            "captcha",
            "access denied",
            "automated access",
            "enable javascript and cookies",
            "just a moment",
            "bot verification",
            "are you a robot",
            "attention required",
            "please complete the security check",
            "ray id",
        ]

        for word in challenge_words:
            if word in combined:
                print(
                    "Security/challenge page detected:",
                    word
                )
                return True

        return False

    except Exception as exc:
        print(
            "Challenge detection error:",
            str(exc)
        )
        return False


# =========================================================
# Jina Reader
# =========================================================

def fetch_with_jina(url):
    try:
        print(
            "Trying Jina Reader:",
            url
        )

        jina_url = (
            "https://r.jina.ai/"
            + url
        )

        headers = {
            "Accept": "text/plain",
            "User-Agent": USER_AGENT,
        }

        jina_key = os.getenv(
            "JINA_API_KEY"
        )

        if jina_key:
            headers["Authorization"] = (
                f"Bearer {jina_key}"
            )

        response = requests.get(
            jina_url,
            headers=headers,
            timeout=60
        )

        print(
            "Jina Reader status:",
            response.status_code
        )

        if response.status_code != 200:
            return None

        content = response.text.strip()

        if not content:
            return None

        # Reject challenge / empty-ish Jina responses
        if is_challenge_page(content):
            print(
                "Jina returned a challenge / blocked page."
            )
            return None

        if len(content) < 80:
            print(
                "Jina content too short, discarding."
            )
            return None

        print(
            "Jina content characters:",
            len(content)
        )

        return content

    except Exception as exc:
        print(
            "Jina Reader failed:",
            str(exc)
        )
        return None


# =========================================================
# Fetch Webpage
# =========================================================

def fetch_page(url):
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": (
            "text/html,application/xhtml+xml,"
            "application/xml;q=0.9,*/*;q=0.8"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    }

    # -----------------------------------------------------
    # Layer 1: Normal HTTP
    # -----------------------------------------------------

    try:
        print(
            "Trying normal HTTP request:",
            url
        )

        response = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True
        )

        if response.status_code == 200:
            # Prefer apparent encoding; fall back safely
            if response.encoding is None or (
                response.encoding.lower() == "iso-8859-1"
            ):
                response.encoding = (
                    response.apparent_encoding
                    or "utf-8"
                )

            html = response.text

            if html and not is_challenge_page(html):
                print(
                    "Normal HTTP request successful."
                )
                return html

            print(
                "Normal request returned a "
                "challenge page."
            )
        else:
            print(
                "Normal HTTP request returned:",
                response.status_code
            )

    except Exception as exc:
        print(
            "Normal HTTP request failed:",
            str(exc)
        )

    # -----------------------------------------------------
    # Layer 2: Jina Reader
    # -----------------------------------------------------

    jina_content = fetch_with_jina(url)

    if jina_content:
        print(
            "Jina successfully retrieved "
            "alternative webpage content."
        )
        return jina_content

    # -----------------------------------------------------
    # Layer 3: Optional Playwright
    #
    # We deliberately keep this optional.
    # On environments where Playwright's sync API
    # cannot start subprocesses, this simply fails
    # and the system continues.
    # -----------------------------------------------------

    try:
        print(
            "Trying browser fallback:",
            url
        )

        from playwright.sync_api import (
            sync_playwright
        )

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True
            )

            page = browser.new_page(
                user_agent=USER_AGENT
            )

            page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=30000
            )

            page.wait_for_timeout(3000)

            html = page.content()

            browser.close()

            if html and not is_challenge_page(html):
                print(
                    "Browser fallback successful."
                )
                return html

    except Exception as exc:
        print(
            "Browser fallback failed:",
            str(exc)
        )

    print(
        "Could not retrieve usable webpage:",
        url
    )

    return None


# =========================================================
# Boilerplate Detection
# =========================================================

BOILERPLATE_WORDS = [
    "cookie",
    "cookies",
    "privacy policy",
    "terms of service",
    "terms and conditions",
    "advertisement",
    "advertising",
    "subscribe",
    "newsletter",
    "sign in",
    "log in",
    "login",
    "register",
    "share this",
    "follow us",
    "related posts",
    "recommended articles",
    "popular posts",
    "trending",
    "sponsored",
    "accept cookies",
    "manage cookies",
    "all rights reserved",
    "copyright",
    "skip to content",
    "skip to main",
    "menu",
    "search",
]


def looks_like_boilerplate(text):
    normalized = normalize_for_matching(text)

    if not normalized:
        return True

    # Very short navigation-like text
    if len(normalized.split()) <= 2:
        return True

    for phrase in BOILERPLATE_WORDS:
        if phrase in normalized:
            return True

    return False


def safe_tag_identifier(tag):
    """
    Safely build a lowercase id+class string for a tag.
    Guards against None attributes and non-list class values.
    """
    if not tag or not hasattr(tag, "get"):
        return ""

    try:
        tag_id = tag.get("id")
        if tag_id is None:
            tag_id = ""
        tag_id = str(tag_id)

        tag_class = tag.get("class")
        if tag_class is None:
            tag_class = []
        elif isinstance(tag_class, str):
            tag_class = [tag_class]
        else:
            try:
                tag_class = [str(c) for c in tag_class]
            except TypeError:
                tag_class = [str(tag_class)]

        return (tag_id + " " + " ".join(tag_class)).lower()
    except Exception:
        return ""


def looks_like_navigation_container(tag):
    """
    Detect common navigation/sidebar/ad containers
    using class/id names without relying on exact
    HTML structure.
    """
    if not tag or not hasattr(tag, "get"):
        return False

    identifier = safe_tag_identifier(tag)

    if not identifier:
        return False

    navigation_words = [
        "nav",
        "navbar",
        "navigation",
        "menu",
        "sidebar",
        "side-bar",
        "breadcrumb",
        "footer",
        "cookie",
        "popup",
        "modal",
        "advert",
        "advertisement",
        "ads",
        "social",
        "share",
        "newsletter",
        "subscription",
        "login",
        "signup",
        "comment",
        "comments",
        "related",
        "recommended",
        "trending",
        "author-box",
        "sticky",
        "banner",
        "promo",
    ]

    return any(
        word in identifier
        for word in navigation_words
    )


# =========================================================
# Main Content Detection
# =========================================================

def find_main_container(soup):
    if soup is None:
        return None

    candidates = []

    try:
        # Strong semantic containers first
        for tag_name in ["main", "article"]:
            for tag in soup.find_all(tag_name):
                if not tag:
                    continue
                try:
                    if tag.get_text(" ", strip=True):
                        candidates.append((tag, 100))
                except Exception:
                    continue

        # Content-like divs / sections
        for tag in soup.find_all(["div", "section"]):
            if not tag:
                continue

            identifier = safe_tag_identifier(tag)

            score = 0

            positive_words = [
                "article",
                "content",
                "main",
                "post",
                "entry",
                "body",
                "documentation",
                "docs",
                "wiki",
                "page-content",
                "post-content",
                "entry-content",
                "text",
                "article-body",
            ]

            negative_words = [
                "sidebar",
                "footer",
                "nav",
                "menu",
                "comment",
                "advert",
                "cookie",
                "related",
                "share",
            ]

            for word in positive_words:
                if word in identifier:
                    score += 20

            for word in negative_words:
                if word in identifier:
                    score -= 30

            try:
                text_length = len(
                    tag.get_text(" ", strip=True)
                )
            except Exception:
                text_length = 0

            if text_length > 500:
                score += min(text_length // 1000, 20)

            if score > 0:
                candidates.append((tag, score))

        if not candidates:
            return soup.body or soup

        candidates.sort(
            key=lambda item: item[1],
            reverse=True
        )

        return candidates[0][0]

    except Exception as exc:
        print("find_main_container error:", str(exc))
        return soup.body or soup


# =========================================================
# Clean Webpage (HTML path)
# =========================================================

def clean_webpage(html):
    try:
        soup = BeautifulSoup(
            html,
            "html.parser"
        )

        title = ""

        try:
            if soup.title and soup.title.string:
                title = normalize_text(
                    soup.title.get_text(" ", strip=True)
                )
            elif soup.title:
                title = normalize_text(
                    soup.title.get_text(" ", strip=True)
                )
        except Exception:
            title = ""

        # Remove definitely unwanted tags.
        for tag in list(soup.find_all(
            [
                "script",
                "style",
                "noscript",
                "svg",
                "canvas",
                "iframe",
                "form",
                "template",
                "button",
                "input",
                "select",
                "textarea",
            ]
        )):
            try:
                tag.decompose()
            except Exception:
                pass

        # Remove containers that clearly look like
        # navigation, advertisements, cookies etc.
        for tag in list(soup.find_all(["nav", "footer", "header"])):
            try:
                tag.decompose()
            except Exception:
                pass

        for tag in list(
            soup.find_all(["div", "section", "aside"])
        ):
            try:
                if looks_like_navigation_container(tag):
                    tag.decompose()
            except Exception:
                continue

        main_container = find_main_container(soup)

        # Last-resort: if main_container is unusable, use body/soup
        if main_container is None:
            main_container = soup.body or soup

        return soup, main_container, title

    except Exception as exc:
        print(
            "Webpage cleaning error:",
            str(exc)
        )
        # Fallback: still try a minimal parse so we
        # do not return empty content for the whole page.
        try:
            soup = BeautifulSoup(html, "html.parser")
            title = ""
            if soup.title:
                try:
                    title = normalize_text(
                        soup.title.get_text(" ", strip=True)
                    )
                except Exception:
                    pass
            for tag in list(soup.find_all(
                ["script", "style", "noscript"]
            )):
                try:
                    tag.decompose()
                except Exception:
                    pass
            return soup, (soup.body or soup), title
        except Exception as exc2:
            print(
                "Webpage cleaning fallback also failed:",
                str(exc2)
            )
            return None, None, ""


# =========================================================
# Structured Content from Plain / Markdown (Jina)
# =========================================================

def extract_structured_from_plain(text, fallback_title=""):
    """
    Convert Jina-style plain text / markdown into the same
    section structure used by the HTML extractor.
    """
    if not text:
        return {
            "title": fallback_title,
            "content": "",
            "sections": []
        }

    lines = text.splitlines()

    title = fallback_title
    sections = []

    current_section = {
        "heading": title or "Main Content",
        "level": 1,
        "content": []
    }

    # Try to pull a title from the first non-empty line
    # or from a markdown H1.
    for line in lines[:15]:
        stripped = line.strip()
        if not stripped:
            continue

        h1 = re.match(r"^#\s+(.+)$", stripped)
        if h1:
            title = normalize_text(h1.group(1))
            current_section["heading"] = title
            break

        if not title and len(stripped) < 120:
            title = normalize_text(stripped)
            current_section["heading"] = title
            break

    heading_re = re.compile(
        r"^(#{1,4})\s+(.+)$"
    )
    # Also catch underlined headings (setext) lightly
    setext_re = re.compile(
        r"^(.+)\n[=-]{3,}\s*$",
        re.MULTILINE
    )

    previous_normalized = ""

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        # Markdown heading
        hm = heading_re.match(stripped)
        if hm:
            if current_section["content"]:
                sections.append(current_section)

            level = min(len(hm.group(1)), 4)
            heading_text = normalize_text(hm.group(2))

            current_section = {
                "heading": heading_text,
                "level": level,
                "content": []
            }
            continue

        # Skip pure URL lines that look like navigation
        if re.match(r"^https?://\S+$", stripped):
            continue

        # Skip markdown image / link-only noise
        if re.match(r"^!\[.*\]\(.*\)$", stripped):
            continue

        text_item = normalize_text(stripped)

        if not text_item:
            continue

        if looks_like_boilerplate(text_item):
            continue

        normalized = normalize_for_matching(text_item)

        if normalized == previous_normalized:
            continue

        # Light list detection
        if re.match(r"^[-*•]\s+", stripped) or re.match(
            r"^\d+[.)]\s+", stripped
        ):
            text_item = "- " + re.sub(
                r"^[-*•]\s+|^\d+[.)]\s+",
                "",
                stripped
            )
            text_item = normalize_text(text_item)

        # Code fence marker (keep content, mark it)
        if stripped.startswith("```"):
            continue

        current_section["content"].append(text_item)
        previous_normalized = normalized

    if current_section["content"]:
        sections.append(current_section)

    # Build readable structured text
    output = []

    for section in sections:
        output.append(
            f"[H{section['level']}] {section['heading']}"
        )
        for item in section["content"]:
            output.append(item)

    structured_text = "\n".join(output)

    if not structured_text.strip():
        structured_text = normalize_text(text)[:MAX_PRIMARY_CONTENT]

    return {
        "title": title or fallback_title,
        "content": structured_text[:MAX_PRIMARY_CONTENT],
        "sections": sections
    }


# =========================================================
# Structured Content Extraction (unified)
# =========================================================

def extract_structured_content(html_or_text):
    """
    Accepts either real HTML or plain/markdown text
    (from Jina) and returns a consistent structure:

        {
            "title": str,
            "content": str,
            "sections": [ {heading, level, content[]} ]
        }
    """
    try:
        if not html_or_text or not html_or_text.strip():
            return {
                "title": "",
                "content": "",
                "sections": []
            }

        # ---------- Plain / Markdown path (Jina) ----------
        if not is_probably_html(html_or_text):
            return extract_structured_from_plain(
                html_or_text
            )

        # ---------- HTML path ----------
        soup, content_root, title = clean_webpage(
            html_or_text
        )

        if content_root is None:
            # Absolute last resort: strip tags crudely
            try:
                raw_soup = BeautifulSoup(
                    html_or_text, "html.parser"
                )
                for t in raw_soup.find_all(
                    ["script", "style", "noscript"]
                ):
                    t.decompose()
                fallback_text = normalize_text(
                    raw_soup.get_text(" ", strip=True)
                )
                if fallback_text:
                    return extract_structured_from_plain(
                        fallback_text, title or ""
                    )
            except Exception:
                pass
            return {
                "title": title or "",
                "content": "",
                "sections": []
            }

        sections = []

        current_section = {
            "heading": title or "Main Content",
            "level": 1,
            "content": []
        }

        try:
            elements = content_root.find_all(
                [
                    "h1",
                    "h2",
                    "h3",
                    "h4",
                    "p",
                    "li",
                    "pre",
                    "code",
                    "blockquote",
                    "table"
                ]
            )
        except Exception:
            elements = []

        previous_normalized = ""

        for element in elements:
            try:
                if not element or not getattr(element, "name", None):
                    continue

                # Ignore nested code inside pre
                if element.name == "code":
                    parent = getattr(element, "parent", None)
                    if parent is not None and getattr(
                        parent, "name", None
                    ) == "pre":
                        continue

                text = normalize_text(
                    element.get_text(" ", strip=True)
                )

                if not text:
                    continue

                # Remove obvious boilerplate
                if (
                    element.name in ["p", "li", "blockquote"]
                    and looks_like_boilerplate(text)
                ):
                    continue

                # Headings
                if element.name in ["h1", "h2", "h3", "h4"]:
                    if current_section["content"]:
                        sections.append(current_section)

                    level = int(element.name[1])

                    current_section = {
                        "heading": text,
                        "level": level,
                        "content": []
                    }
                    continue

                # List items
                if element.name == "li":
                    text = "- " + text

                # Code
                elif element.name in ["pre", "code"]:
                    text = "[CODE] " + text

                # Quote
                elif element.name == "blockquote":
                    text = "[QUOTE] " + text

                # Tables
                elif element.name == "table":
                    rows = []

                    for row in element.find_all("tr"):
                        cells = [
                            normalize_text(
                                cell.get_text(" ", strip=True)
                            )
                            for cell in row.find_all(
                                ["th", "td"]
                            )
                        ]

                        cells = [c for c in cells if c]

                        if cells:
                            rows.append(" | ".join(cells))

                    if rows:
                        text = "\n".join(rows)
                    else:
                        continue

                normalized = normalize_for_matching(text)

                if normalized == previous_normalized:
                    continue

                current_section["content"].append(text)
                previous_normalized = normalized

            except Exception:
                continue

        if current_section["content"]:
            sections.append(current_section)

        # -------------------------------------------------
        # Remove near-duplicate sections
        # -------------------------------------------------

        cleaned_sections = []
        seen_headings = set()

        for section in sections:
            content = []
            prev = ""

            for item in section["content"]:
                normalized = normalize_for_matching(item)

                if not normalized or normalized == prev:
                    continue

                content.append(item)
                prev = normalized

            if not content:
                continue

            heading_key = normalize_for_matching(
                section["heading"]
            )

            if heading_key not in seen_headings:
                seen_headings.add(heading_key)

            cleaned_sections.append(
                {
                    "heading": section["heading"],
                    "level": section["level"],
                    "content": content
                }
            )

        # Build readable structured text
        output = []

        for section in cleaned_sections:
            output.append(
                f"[H{section['level']}] "
                f"{section['heading']}"
            )
            for item in section["content"]:
                output.append(item)

        structured_text = "\n".join(output)

        # Fallback to raw text if structure is empty
        if not structured_text.strip():
            try:
                fallback = normalize_text(
                    content_root.get_text(" ", strip=True)
                )
            except Exception:
                fallback = ""
            structured_text = fallback

            # If we only have a blob of text, still
            # expose it as one section so relevance
            # matching can work.
            if structured_text.strip() and not cleaned_sections:
                cleaned_sections = [
                    {
                        "heading": title or "Main Content",
                        "level": 1,
                        "content": [
                            structured_text[:8000]
                        ]
                    }
                ]

        return {
            "title": title,
            "content": structured_text[:MAX_PRIMARY_CONTENT],
            "sections": cleaned_sections
        }

    except Exception as exc:
        print(
            "Structured extraction error:",
            str(exc)
        )
        # Final emergency fallback
        try:
            raw = BeautifulSoup(
                html_or_text, "html.parser"
            )
            for t in raw.find_all(
                ["script", "style", "noscript"]
            ):
                t.decompose()
            text = normalize_text(
                raw.get_text(" ", strip=True)
            )
            if text:
                return extract_structured_from_plain(text)
        except Exception:
            pass
        return {
            "title": "",
            "content": "",
            "sections": []
        }


# =========================================================
# Instruction Analyzer
# =========================================================

def analyze_instruction(instruction):
    """
    Extract the core target topics the user is asking about.

    Examples:
        "Explain abstraction"      -> ["abstraction"]
        "Explain locations"        -> ["locations"]
        "Compare X and Y"          -> ["x", "y"]
        "What is polymorphism?"    -> ["polymorphism"]
    """
    if not instruction or not instruction.strip():
        return []

    text = instruction.strip()
    lowered = text.lower()

    # Strip common question prefixes
    prefixes = [
        r"^(please\s+)?(can you|could you|would you)\s+",
        r"^(explain|describe|summarize|summary of|tell me about|"
        r"what is|what are|what does|how does|how do|"
        r"define|definition of|overview of|details on|"
        r"details about|info on|information about|"
        r"list|show|find|get|extract)\s+",
        r"^(a |an |the )\s*",
    ]

    cleaned = lowered
    for pattern in prefixes:
        cleaned = re.sub(pattern, "", cleaned, flags=re.I)

    cleaned = cleaned.strip(" ?.!,;:")

    # Compare patterns: "compare X and Y", "X vs Y", "X versus Y"
    compare_match = re.search(
        r"(?:compare|contrast)\s+(.+?)\s+(?:and|with|vs\.?|versus)\s+(.+)",
        cleaned,
        re.I
    )
    if compare_match:
        a = normalize_for_matching(compare_match.group(1))
        b = normalize_for_matching(compare_match.group(2))
        targets = [t for t in [a, b] if t]
        return targets

    vs_match = re.search(
        r"(.+?)\s+(?:vs\.?|versus)\s+(.+)",
        cleaned,
        re.I
    )
    if vs_match:
        a = normalize_for_matching(vs_match.group(1))
        b = normalize_for_matching(vs_match.group(2))
        targets = [t for t in [a, b] if t]
        return targets

    # Generic: take meaningful tokens as targets
    tokens = tokenize(cleaned)

    # Drop very generic words that add little topic signal
    stop = {
        "the", "and", "for", "with", "from", "this", "that",
        "about", "page", "website", "site", "content",
        "article", "section", "topic", "please", "more",
        "detailed", "briefly", "short", "long"
    }

    targets = [
        t for t in tokens
        if t not in stop and len(t) > 2
    ]

    # Prefer the last few meaningful tokens (often the topic)
    if len(targets) > 6:
        targets = targets[-6:]

    return targets


# =========================================================
# Find Relevant Sections
# =========================================================

def find_relevant_sections(sections, instruction):
    if not sections:
        return []

    instruction_clean = normalize_for_matching(instruction)

    if not instruction_clean:
        # No instruction → return a reasonable amount of
        # leading content rather than everything.
        return sections[:6]

    keywords = tokenize(instruction)
    targets = analyze_instruction(instruction)

    # Merge targets into keywords for overlap scoring
    all_keywords = list(
        dict.fromkeys(keywords + targets)
    )

    scored = []

    for index, section in enumerate(sections):
        heading = section["heading"]
        body = " ".join(section["content"])

        heading_score = similarity(
            instruction_clean,
            heading
        )

        heading_overlap = keyword_overlap(
            heading,
            all_keywords
        )

        body_overlap = keyword_overlap(
            body,
            all_keywords
        )

        # Heading is much more important than
        # arbitrary body word matches.
        score = (
            heading_score * 0.55
            + heading_overlap * 0.30
            + body_overlap * 0.15
        )

        # Exact topic occurrence in heading
        heading_norm = normalize_for_matching(heading)

        if instruction_clean in heading_norm:
            score += 0.40

        for target in targets:
            if target and target in heading_norm:
                score += 0.35
            if target and target in normalize_for_matching(body):
                score += 0.08

        # Extra boost when individual keywords appear in the heading
        for kw in all_keywords:
            if len(kw) > 4 and kw in heading_norm:
                score += 0.15

        scored.append((score, index, section))

    scored.sort(key=lambda item: item[0], reverse=True)

    selected = []

    for score, index, section in scored:
        if score < 0.15:
            continue

        selected.append((score, index, section))

        if len(selected) >= 5:
            break

    # Include neighbouring sections because a topic
    # often spans multiple headings.
    expanded = []
    used_indexes = set()

    for score, index, section in selected:
        for candidate_index in [index - 1, index, index + 1]:
            if 0 <= candidate_index < len(sections):
                if candidate_index in used_indexes:
                    continue

                used_indexes.add(candidate_index)
                expanded.append(sections[candidate_index])

    # If nothing scored high enough, fall back to top sections
    # by raw keyword presence so we never return empty when
    # the page has content.
    if not expanded and sections:
        fallback = []
        for score, index, section in scored[:3]:
            if score > 0.05:
                fallback.append(section)
        if fallback:
            return fallback
        return sections[:3]

    return expanded


def section_text(sections, max_chars):
    output = []

    for section in sections:
        output.append(
            f"[H{section['level']}] "
            f"{section['heading']}"
        )
        for item in section["content"]:
            output.append(item)

    text = "\n".join(output)
    return text[:max_chars]


# =========================================================
# Determine Whether Primary Page Is Sufficient
# =========================================================

def primary_page_is_relevant(sections, instruction):
    relevant = find_relevant_sections(
        sections,
        instruction
    )

    if not relevant:
        return False, []

    evidence = section_text(relevant, 16000)

    # A meaningful amount of matching content is required.
    if len(normalize_text(evidence)) < 120:
        return False, relevant

    return True, relevant


# =========================================================
# Link Filtering
# =========================================================

IGNORED_DOMAINS = {
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "google.com",
    "google-analytics.com",
    "googletagmanager.com",
    "cloudflare.com",
    "doubleclick.net",
    "googlesyndication.com",
}


IGNORED_PATH_WORDS = {
    "login",
    "signin",
    "sign-in",
    "signup",
    "sign-up",
    "register",
    "logout",
    "privacy",
    "terms",
    "cookie",
    "cookies",
    "advert",
    "advertisement",
    "tracking",
    "challenge",
    "captcha",
    "verification",
    "verify",
    "search",
    "share",
    "cart",
    "checkout",
    "account",
    "password",
}


def is_useful_link(url, base_url):
    try:
        parsed = urlparse(url)
        base = urlparse(base_url)

        if parsed.scheme not in ["http", "https"]:
            return False

        if not parsed.hostname:
            return False

        hostname = parsed.hostname.lower()
        base_hostname = (
            base.hostname.lower()
            if base.hostname
            else ""
        )

        if hostname in IGNORED_DOMAINS:
            return False

        if any(
            hostname.endswith("." + domain)
            for domain in IGNORED_DOMAINS
        ):
            return False

        path = parsed.path.lower()

        for word in IGNORED_PATH_WORDS:
            if word in path:
                return False

        # Keep same-domain pages only.
        # Cross-domain links are generally not useful
        # for the requested website analysis.
        if hostname != base_hostname:
            return False

        # Skip pure anchors / empty paths that resolve
        # to the same page
        if not path or path == "/":
            return False

        return True

    except Exception:
        return False


# =========================================================
# Extract Candidate Links
# =========================================================

def extract_links(html, base_url):
    links = []

    try:
        # Only attempt HTML link extraction
        if not is_probably_html(html):
            # Best-effort: pull markdown-style links from Jina
            md_links = re.findall(
                r"\[([^\]]+)\]\((https?://[^)]+)\)",
                html
            )
            seen = set()
            for text, href in md_links:
                full_url, _ = urldefrag(href)
                if full_url in seen:
                    continue
                if not is_useful_link(full_url, base_url):
                    continue
                text = normalize_text(text)
                if len(text) < 2:
                    continue
                seen.add(full_url)
                links.append({"url": full_url, "text": text})
            return links

        soup = BeautifulSoup(html, "html.parser")

        seen_urls = set()

        for anchor in soup.find_all("a", href=True):
            href = anchor.get("href")

            if not href:
                continue

            full_url = urljoin(base_url, href)
            full_url, _ = urldefrag(full_url)

            if not is_useful_link(full_url, base_url):
                continue

            if full_url in seen_urls:
                continue

            text = normalize_text(
                anchor.get_text(" ", strip=True)
            )

            if not text or len(text) < 2:
                continue

            generic_labels = {
                "home",
                "menu",
                "next",
                "previous",
                "click here",
                "read more",
                "learn more",
                "more",
                "back",
                "top",
                "skip",
            }

            if text.lower() in generic_labels:
                continue

            seen_urls.add(full_url)
            links.append(
                {
                    "url": full_url,
                    "text": text
                }
            )

    except Exception as exc:
        print(
            "Link extraction error:",
            str(exc)
        )

    return links


# =========================================================
# Rank Links According to User Instruction
# =========================================================

def rank_links(links, instruction, base_url):
    if not links:
        return []

    keywords = tokenize(instruction)
    targets = analyze_instruction(instruction)
    all_keywords = list(
        dict.fromkeys(keywords + targets)
    )

    ranked = []

    for link in links:
        link_text = link["text"]
        link_url = link["url"]

        parsed = urlparse(link_url)
        path = (
            parsed.path
            .replace("-", " ")
            .replace("_", " ")
        )

        text_score = keyword_overlap(
            link_text,
            all_keywords
        )

        url_score = keyword_overlap(
            path,
            all_keywords
        )

        similarity_score = similarity(
            instruction,
            link_text
        )

        score = (
            text_score * 0.50
            + url_score * 0.30
            + similarity_score * 0.20
        )

        # Strong boost when the topic appears
        # directly in the link text.
        normalized_instruction = normalize_for_matching(
            instruction
        )
        normalized_link = normalize_for_matching(
            link_text
        )

        if (
            normalized_instruction
            and normalized_instruction in normalized_link
        ):
            score += 0.50

        for target in targets:
            if target and target in normalized_link:
                score += 0.30
            if target and target in normalize_for_matching(path):
                score += 0.20

        ranked.append((score, link))

    ranked.sort(key=lambda item: item[0], reverse=True)

    return ranked


# =========================================================
# Build Focused Evidence
# =========================================================

def build_evidence(instruction, primary_data, internal_results):
    parts = []

    # -----------------------------------------------------
    # Primary evidence
    # -----------------------------------------------------

    primary_sections = find_relevant_sections(
        primary_data.get("sections", []),
        instruction
    )

    if primary_sections:
        primary_text = section_text(
            primary_sections,
            20000
        )

        if primary_text.strip():
            parts.append(
                "PRIMARY RESOURCE - RELEVANT CONTENT\n"
                + primary_text
            )
    else:
        # Fallback: limited primary content if no sections matched
        fallback = primary_data.get("content", "")[:8000]
        if fallback.strip():
            parts.append(
                "PRIMARY RESOURCE - CONTENT\n"
                + fallback
            )

    # -----------------------------------------------------
    # Internal evidence
    # -----------------------------------------------------

    for item in internal_results:
        page_title = item.get("title", "")
        page_url = item.get("url", "")

        relevant_sections = find_relevant_sections(
            item.get("sections", []),
            instruction
        )

        if relevant_sections:
            content = section_text(
                relevant_sections,
                7000
            )
        else:
            content = item.get("content", "")[:5000]

        if not content.strip():
            continue

        parts.append(
            "\nINTERNAL RESOURCE\n"
            f"TITLE: {page_title}\n"
            f"URL: {page_url}\n"
            f"RELEVANT CONTENT:\n{content}"
        )

    evidence = "\n\n".join(parts)

    return evidence[:MAX_LLM_EVIDENCE]


# =========================================================
# Generate AI Answer
# =========================================================

def generate_answer(instruction, url, evidence):
    if not evidence.strip():
        return (
            "Helix AI could not find enough "
            "relevant content on this webpage "
            "to answer the requested instruction."
        )

    user_request = (
        instruction.strip()
        if instruction.strip()
        else "Provide a useful analysis of the webpage."
    )

    prompt = f"""
You are Helix AI, a precise webpage research assistant.

USER REQUEST:
{user_request}

SOURCE URL:
{url}

The following is carefully selected content from the
webpage and, when necessary, directly relevant internal
pages.

Your job is to answer the user's request using this
source material.

IMPORTANT RULES:

1. Answer the user's specific request.
2. Use ONLY the supplied source material. Nothing else.
3. Do not invent company names, years, ownership changes, products, or deals.
4. If a name (e.g. a joint venture) does not appear in the source text, do not mention it.
5. If the source lists several related items under a topic, cover ALL of them unless the user asked for only one.
6. Do not use your general knowledge about the company or website.
7. If the source is incomplete for the request, say so clearly instead of filling gaps.
8. Do not mention scraping, extraction, Python, APIs, prompts, or internal processing.
9. Do not unnecessarily repeat the question.
10. Preserve important names and dates exactly as they appear in the source.
11. Keep the response professional and easy to understand.

OUTPUT STYLE:

- Give a direct answer first.
- Use short paragraphs.
- Use bullet points when they genuinely improve clarity.
- Use headings when the answer has multiple distinct parts.
- Do not force a fixed 2-3 paragraph format.
- Match the answer length to the user's request.
- Be detailed enough to be useful but avoid unnecessary
  repetition.

SOURCE MATERIAL:

{evidence}
"""

    try:
        response = (
            groq_client
            .chat
            .completions
            .create(
                model=GROQ_MODEL,
                max_tokens=MAX_OUTPUT_TOKENS,
                temperature=0.2,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
        )

        answer = (
            response
            .choices[0]
            .message
            .content
        )

        return (
            answer.strip()
            if answer
            else "No answer was generated."
        )

    except Exception as exc:
        print(
            "Groq generation error:",
            str(exc)
        )
        return f"Error: {str(exc)}"


# =========================================================
# Save Website Resource
# =========================================================

def save_resource(url, summary):
    created_at = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    try:
        with db() as conn:
            conn.execute(
                """
                INSERT INTO resources
                (
                    resource_key,
                    title,
                    link,
                    description,
                    tags,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "website",
                    url,
                    url,
                    summary,
                    "website,ai-summary",
                    created_at
                )
            )

    except Exception as exc:
        print(
            "Database save error:",
            str(exc)
        )


# =========================================================
# Main Analyze URL Endpoint
# =========================================================

@router.post("/analyze-url")
def analyze_url(request: URLRequest):
    url = normalize_url(request.url)
    instruction = (request.instruction or "").strip()

    print("\n========================================")
    print("Received URL:", url)
    print("User instruction:", instruction)
    print("========================================")

    # -----------------------------------------------------
    # Validate URL
    # -----------------------------------------------------

    try:
        parsed = urlparse(url)

        if parsed.scheme not in ["http", "https"]:
            return {
                "message":
                    "Please enter a valid HTTP or HTTPS URL."
            }

        if not parsed.hostname:
            return {
                "message":
                    "Please enter a valid website URL."
            }

    except Exception:
        return {
            "message":
                "Please enter a valid website URL."
        }

    try:
        # =================================================
        # STEP 1 — Fetch primary page
        # =================================================

        main_html = fetch_page(url)

        if not main_html:
            return {
                "message": (
                    "This website does not allow "
                    "automated access. Helix AI "
                    "could not retrieve its content."
                )
            }

        # =================================================
        # STEP 2 — Extract structured primary content
        # =================================================

        main_data = extract_structured_content(main_html)

        main_content = main_data.get("content", "")

        print(
            "Main content characters:",
            len(main_content)
        )

        if not main_content.strip():
            return {
                "message": (
                    "Helix AI could not find useful "
                    "content on this webpage."
                )
            }

        # =================================================
        # STEP 3 — Check requested topic on primary page
        # =================================================

        primary_sufficient = False
        primary_sections = []

        if instruction:
            primary_sufficient, primary_sections = (
                primary_page_is_relevant(
                    main_data.get("sections", []),
                    instruction
                )
            )

            if primary_sufficient:
                print(
                    "Relevant content found directly "
                    "on primary page."
                )
            else:
                print(
                    "Primary page does not contain "
                    "enough directly relevant content."
                )
        else:
            primary_sections = []

        # =================================================
        # STEP 4 — Internal links only when necessary
        # =================================================

        internal_results = []

        if instruction and not primary_sufficient:
            print("Searching relevant internal links...")

            links = extract_links(main_html, url)

            print(
                "Candidate links collected:",
                len(links)
            )

            links = links[:MAX_CANDIDATE_LINKS]

            ranked_links = rank_links(
                links,
                instruction,
                url
            )

            selected_links = []

            for score, link in ranked_links:
                if score < 0.08:
                    continue

                selected_links.append((score, link))

                if len(selected_links) >= MAX_INTERNAL_PAGES:
                    break

            print(
                "Relevant links selected:",
                len(selected_links)
            )

            # ---------------------------------------------
            # Fetch only selected pages
            # ---------------------------------------------

            for score, link in selected_links:
                link_url = link["url"]
                link_text = link["text"]

                print(
                    "Selected:",
                    link_text,
                    "->",
                    link_url
                )

                linked_html = fetch_page(link_url)

                if not linked_html:
                    continue

                linked_data = extract_structured_content(
                    linked_html
                )

                linked_content = linked_data.get(
                    "content",
                    ""
                )

                if not linked_content.strip():
                    continue

                relevant_sections = find_relevant_sections(
                    linked_data.get("sections", []),
                    instruction
                )

                if not relevant_sections:
                    print(
                        "No relevant section found:",
                        link_text
                    )
                    continue

                relevant_text = section_text(
                    relevant_sections,
                    MAX_INTERNAL_CONTENT
                )

                if len(normalize_text(relevant_text)) < 100:
                    continue

                internal_results.append(
                    {
                        "title": (
                            linked_data.get("title")
                            or link_text
                        ),
                        "url": link_url,
                        "content": relevant_text,
                        "sections": relevant_sections
                    }
                )

                print(
                    "Relevant content extracted from:",
                    link_text
                )

        # =================================================
        # STEP 5 — Build focused evidence
        # =================================================

        evidence = build_evidence(
            instruction,
            main_data,
            internal_results
        )

        print(
            "Final evidence characters:",
            len(evidence)
        )

        if not evidence.strip():
            return {
                "message": (
                    "Helix AI could not find enough "
                    "relevant content on this webpage "
                    "to answer the requested instruction."
                )
            }

        # =================================================
        # STEP 6 — Send ONLY focused evidence to Groq
        # =================================================

        summary = generate_answer(
            instruction,
            url,
            evidence
        )

        # =================================================
        # STEP 7 — Save result
        # =================================================

        if not summary.startswith("Error:"):
            save_resource(url, summary)

        # =================================================
        # STEP 8 — Return
        # =================================================

        return {
            "message": summary
        }

    except Exception as exc:
        print(
            "Analyze URL Error:",
            str(exc)
        )
        return {
            "message": f"Error: {str(exc)}"
        }


# =========================================================
# Web Resources
# =========================================================

@router.get("/web-resources")
def get_web_resources():
    try:
        with db() as conn:
            rows = conn.execute(
                """
                SELECT
                    id,
                    title,
                    link,
                    description,
                    tags,
                    created_at
                FROM resources
                WHERE resource_key = ?
                ORDER BY id DESC
                """,
                ("website",)
            ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    except Exception as exc:
        return {
            "message": str(exc)
        }


# =========================================================
# Delete Website Resource
# =========================================================

@router.delete("/web-resources/{resource_id}")
def delete_web_resource(resource_id: int):
    try:
        with db() as conn:
            cursor = conn.execute(
                """
                DELETE FROM resources
                WHERE id = ?
                AND resource_key = ?
                """,
                (
                    resource_id,
                    "website"
                )
            )

            if cursor.rowcount == 0:
                return {
                    "success": False,
                    "message": "Website not found."
                }

        return {
            "success": True,
            "message":
                "Website deleted successfully."
        }

    except Exception as exc:
        return {
            "success": False,
            "message": str(exc)
        }