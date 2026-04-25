"""Markdown-AST extraction → NoteSpan rows.

Uses mistune's BlockState walker to produce a flat span list per note.
Each span carries the original markdown kind (heading / paragraph /
list_item / code / math / link / quote / callout), depth (heading level
or list nesting), the cleaned text, and inclusive char offsets into the
note's raw_text. Spans are the unit of downstream concept + relation
extraction.

Idempotent at the caller's level: callers should DELETE existing rows
for the (space_id, note_id) before inserting the fresh batch.
"""
from __future__ import annotations

import re
import uuid
from typing import Iterable

import mistune

from ..models import NoteRecord, NoteSpan, SpanKind


_MATH_BLOCK_RE = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
_MATH_INLINE_RE = re.compile(r"\$(?!\$)([^$\n]+?)\$")
_CALLOUT_RE = re.compile(r"^\s*(?:>\s*)?\[!(\w+)\]")


def _clean(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.split())


def _locate(haystack: str, needle: str, start: int) -> tuple[int, int]:
    """Best-effort char range for a span. Falls back to a rolling cursor."""
    if not needle:
        return start, start
    n = needle.strip()
    if not n:
        return start, start
    idx = haystack.find(n, start)
    if idx < 0:
        # Try lowercased substring as a soft fallback.
        lo = haystack.lower().find(n.lower(), start)
        if lo < 0:
            return start, start + len(n)
        idx = lo
    return idx, idx + len(n)


def _walk(tokens: Iterable[dict], depth: int = 0):
    for tok in tokens:
        yield depth, tok
        children = tok.get("children")
        if isinstance(children, list):
            yield from _walk(children, depth + 1)


def _token_text(tok: dict) -> str:
    if "raw" in tok and isinstance(tok["raw"], str):
        return tok["raw"]
    chunks: list[str] = []

    def _collect(node: dict) -> None:
        if "raw" in node and isinstance(node["raw"], str):
            chunks.append(node["raw"])
            return
        for child in node.get("children") or []:
            _collect(child)

    _collect(tok)
    return "".join(chunks)


def extract_spans(note: NoteRecord) -> list[NoteSpan]:
    """Parse a note's markdown into a flat list of NoteSpan rows.

    Returns spans in document order. Char offsets are best-effort (the
    parser strips inline markup, so we match the cleaned text against
    the raw text with a forward cursor).
    """
    raw = note.raw_text or ""
    if not raw.strip():
        return []

    md = mistune.create_markdown(renderer=None, plugins=["table", "strikethrough"])
    try:
        tokens = md(raw)
    except Exception:
        return []
    if not isinstance(tokens, list):
        return []

    spans: list[NoteSpan] = []
    cursor = 0
    list_depth = 0

    for parent_depth, tok in _walk(tokens):
        ttype = tok.get("type", "")

        if ttype == "list":
            list_depth += 1
            continue
        if ttype == "list_end":
            list_depth = max(0, list_depth - 1)
            continue
        if ttype == "list_item":
            text = _clean(_token_text(tok))
            if not text:
                continue
            start, end = _locate(raw, text, cursor)
            cursor = max(cursor, end)
            spans.append(_make_span(note, SpanKind.LIST_ITEM, max(1, list_depth), text, start, end))
            continue
        if ttype == "heading":
            level = int(tok.get("attrs", {}).get("level", 1) or 1)
            text = _clean(_token_text(tok))
            if not text:
                continue
            start, end = _locate(raw, text, cursor)
            cursor = max(cursor, end)
            spans.append(_make_span(note, SpanKind.HEADING, level, text, start, end))
            continue
        if ttype == "paragraph":
            text = _clean(_token_text(tok))
            if not text:
                continue
            # Detect callouts (Obsidian-style "> [!note] ...").
            if _CALLOUT_RE.match(text):
                start, end = _locate(raw, text, cursor)
                cursor = max(cursor, end)
                spans.append(_make_span(note, SpanKind.CALLOUT, 0, text, start, end))
                continue
            start, end = _locate(raw, text, cursor)
            cursor = max(cursor, end)
            spans.append(_make_span(note, SpanKind.PARAGRAPH, 0, text, start, end))
            # Math + link extraction inside the paragraph.
            for m in _MATH_BLOCK_RE.finditer(text):
                spans.append(_make_span(note, SpanKind.MATH, 0, m.group(1).strip(), start + m.start(), start + m.end()))
            for m in _MATH_INLINE_RE.finditer(text):
                spans.append(_make_span(note, SpanKind.MATH, 0, m.group(1).strip(), start + m.start(), start + m.end()))
            continue
        if ttype == "block_code":
            text = _token_text(tok)
            if not text.strip():
                continue
            start, end = _locate(raw, text, cursor)
            cursor = max(cursor, end)
            spans.append(_make_span(note, SpanKind.CODE, 0, text, start, end))
            continue
        if ttype == "block_quote":
            text = _clean(_token_text(tok))
            if not text:
                continue
            kind = SpanKind.CALLOUT if _CALLOUT_RE.match(text) else SpanKind.QUOTE
            start, end = _locate(raw, text, cursor)
            cursor = max(cursor, end)
            spans.append(_make_span(note, kind, 0, text, start, end))
            continue
        if ttype == "link":
            text = _clean(_token_text(tok))
            href = tok.get("attrs", {}).get("url", "")
            payload = f"{text} → {href}" if href else text
            if not payload:
                continue
            start, end = _locate(raw, text or href, cursor)
            spans.append(_make_span(note, SpanKind.LINK, parent_depth, payload, start, end))
            continue

    return spans


def _make_span(
    note: NoteRecord,
    kind: SpanKind,
    depth: int,
    text: str,
    char_start: int,
    char_end: int,
) -> NoteSpan:
    return NoteSpan(
        space_id=note.space_id,
        note_id=note.id,
        kind=kind,
        depth=int(depth),
        text=text[:8000],
        char_start=int(char_start),
        char_end=int(char_end),
        parent_span_id=None,
        id=str(uuid.uuid4()),
    )


def extract_all(notes: list[NoteRecord]) -> list[NoteSpan]:
    out: list[NoteSpan] = []
    for n in notes:
        out.extend(extract_spans(n))
    return out
