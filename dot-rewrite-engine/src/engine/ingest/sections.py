"""Section-aware parser. Splits note markdown into WeightedSections.

Heuristics (no AST): # headings -> TITLE, lines ending ':' short -> DEFINITION,
lines starting '-','*','1.' -> BULLET, blocks prefixed 'ex:' / 'example:' -> EXAMPLE,
rest -> BODY.

Markdown / formula handling:
- `strip_block` lifts math (`$...$`, `$$...$$`) into stable `math_<hash>`
  tokens and removes code fences + HTML _before_ we split on lines, so math
  spanning multiple lines survives and fenced code never pollutes sections.
- `strip_inline` is then applied to each emitted section's text to drop
  bold/italic markers, inline code, links, images, table pipes and
  blockquote `>` — the engine should see words and formulas only.
"""
from __future__ import annotations

import re

from ..config import SectionWeights
from ..models import SectionKind, WeightedSection
from . import markdown as md

_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.*)$")
_BULLET = re.compile(r"^\s*([-*•]|\d+\.)\s+(.*)$")
_EXAMPLE = re.compile(r"^\s*(ex|example|e\.g\.)[:.]\s*(.*)$", re.IGNORECASE)


def parse(text: str, weights: SectionWeights) -> list[WeightedSection]:
    text = md.strip_block(text)
    out: list[WeightedSection] = []
    body_buf: list[str] = []

    def flush_body():
        if body_buf:
            merged = md.strip_inline("\n".join(body_buf)).strip()
            if merged:
                out.append(WeightedSection(
                    kind=SectionKind.BODY,
                    text=merged,
                    weight=weights.body,
                ))
            body_buf.clear()

    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            flush_body()
            continue

        m = _HEADING.match(line)
        if m:
            flush_body()
            cleaned = md.strip_inline(m.group(1)).strip()
            if cleaned:
                out.append(WeightedSection(
                    kind=SectionKind.TITLE, text=cleaned, weight=weights.title,
                ))
            continue

        m = _EXAMPLE.match(line)
        if m:
            flush_body()
            cleaned = md.strip_inline(m.group(2)).strip()
            if cleaned:
                out.append(WeightedSection(
                    kind=SectionKind.EXAMPLE, text=cleaned, weight=weights.example,
                ))
            continue

        m = _BULLET.match(line)
        if m:
            flush_body()
            cleaned = md.strip_inline(m.group(2)).strip()
            if cleaned:
                out.append(WeightedSection(
                    kind=SectionKind.BULLET, text=cleaned, weight=weights.bullet,
                ))
            continue

        if line.strip().endswith(":") and len(line) < 80:
            flush_body()
            cleaned = md.strip_inline(line.strip().rstrip(":")).strip()
            if cleaned:
                out.append(WeightedSection(
                    kind=SectionKind.DEFINITION, text=cleaned, weight=weights.definition,
                ))
            continue

        body_buf.append(line)

    flush_body()
    return out
