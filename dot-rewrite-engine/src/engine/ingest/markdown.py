"""Markdown cleaner + math formula extractor.

Goal: the engine should see _words_ and _formulas_, not markdown syntax.

- `$...$` and `$$...$$` blocks are lifted out first and replaced by a
  synthetic token `math_<8-hex-hash> <letter identifiers>`. The hash makes
  identical formulas collide (two notes that both cite `F=ma` share a
  feature); the letter identifiers (`f`, `m`, `a`) let TF-IDF still see the
  semantic symbols.
- Code fences (``` ```), inline code (`x`), images, links, bold/italic,
  strikethrough, HTML tags, blockquote markers, horizontal rules and table
  pipes are stripped / reduced to their visible text.
- Heading markers (`#`) are intentionally preserved for the section parser
  in `sections.py`. Call `strip_inline` AFTER section classification.
"""
from __future__ import annotations

import hashlib
import re

_MATH_BLOCK = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
_MATH_INLINE = re.compile(r"(?<!\\)\$([^$\n]+?)(?<!\\)\$")

_CODE_FENCE = re.compile(r"```.*?```", re.DOTALL)
_INLINE_CODE = re.compile(r"`[^`\n]+`")
_HTML_TAG = re.compile(r"<[^>\n]+>")

_IMAGE = re.compile(r"!\[([^\]]*)\]\([^)\s]*\)")
_LINK = re.compile(r"\[([^\]]+)\]\([^)\s]*\)")
_BARE_URL = re.compile(r"https?://\S+")

_STRIKE = re.compile(r"~~(.+?)~~")
_BOLD = re.compile(r"(\*\*|__)(.+?)\1", re.DOTALL)
_ITAL = re.compile(r"(?<![\\*_])(\*|_)(?!\s)(.+?)(?<!\s)\1(?![*_])", re.DOTALL)

_HR = re.compile(r"^\s*(?:[-*_]\s*){3,}\s*$", re.MULTILINE)
_BLOCKQUOTE = re.compile(r"^\s*>\s?", re.MULTILINE)
_TABLE_PIPE = re.compile(r"\|")
_TABLE_SEP = re.compile(r"^\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+$", re.MULTILINE)

_WORD = re.compile(r"[A-Za-z][A-Za-z0-9]*")


def _math_token(expr: str) -> str:
    """Deterministic token for a math expression.

    Returns `math_<hash>` plus any latin letter identifiers as ordinary
    lowercase tokens. Whitespace-insensitive so `F = m a` and `F=ma` match.
    """
    compact = re.sub(r"\s+", "", expr)
    h = hashlib.md5(compact.encode("utf-8")).hexdigest()[:8]
    letters = sorted({m.group(0).lower() for m in _WORD.finditer(expr)})
    parts = [f"math_{h}"]
    parts.extend(t for t in letters if len(t) > 1 or t in {"x", "y", "z"})
    return " " + " ".join(parts) + " "


def extract_math(text: str) -> str:
    """Pull math blocks out and replace with stable tokens."""
    text = _MATH_BLOCK.sub(lambda m: _math_token(m.group(1)), text)
    text = _MATH_INLINE.sub(lambda m: _math_token(m.group(1)), text)
    return text


def strip_block(text: str) -> str:
    """Whole-document cleanup: math + code fences + HTML.

    Does NOT strip `#` / `-` / `*` markers because the section parser reads
    those. Apply `strip_inline` after section classification.
    """
    text = extract_math(text)
    text = _CODE_FENCE.sub(" ", text)
    text = _HTML_TAG.sub(" ", text)
    text = _IMAGE.sub(r"\1", text)
    text = _TABLE_SEP.sub(" ", text)
    return text


def strip_inline(text: str) -> str:
    """Per-section cleanup: emphasis, inline code, links, blockquote, tables."""
    text = _INLINE_CODE.sub(" ", text)
    text = _IMAGE.sub(r"\1", text)
    text = _LINK.sub(r"\1", text)
    text = _BARE_URL.sub(" ", text)
    text = _STRIKE.sub(r"\1", text)
    text = _BOLD.sub(r"\2", text)
    text = _ITAL.sub(r"\2", text)
    text = _BLOCKQUOTE.sub("", text)
    text = _TABLE_PIPE.sub(" ", text)
    text = _HR.sub(" ", text)
    return text


def clean(text: str) -> str:
    """Full clean for contexts that don't need section classification."""
    return strip_inline(strip_block(text))
