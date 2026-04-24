"""Section-aware parser. Splits note markdown into WeightedSections.

Heuristics (no AST): # headings -> TITLE, lines ending ':' short -> DEFINITION,
lines starting '-','*','1.' -> BULLET, blocks prefixed 'ex:' / 'example:' -> EXAMPLE,
rest -> BODY.
"""
from __future__ import annotations

import re

from ..config import SectionWeights
from ..models import SectionKind, WeightedSection

_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.*)$")
_BULLET = re.compile(r"^\s*([-*•]|\d+\.)\s+(.*)$")
_EXAMPLE = re.compile(r"^\s*(ex|example|e\.g\.)[:.]\s*(.*)$", re.IGNORECASE)


def parse(text: str, weights: SectionWeights) -> list[WeightedSection]:
    out: list[WeightedSection] = []
    body_buf: list[str] = []

    def flush_body():
        if body_buf:
            out.append(WeightedSection(
                kind=SectionKind.BODY,
                text="\n".join(body_buf).strip(),
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
            out.append(WeightedSection(kind=SectionKind.TITLE, text=m.group(1), weight=weights.title))
            continue

        m = _EXAMPLE.match(line)
        if m:
            flush_body()
            out.append(WeightedSection(kind=SectionKind.EXAMPLE, text=m.group(2), weight=weights.example))
            continue

        m = _BULLET.match(line)
        if m:
            flush_body()
            out.append(WeightedSection(kind=SectionKind.BULLET, text=m.group(2), weight=weights.bullet))
            continue

        if line.strip().endswith(":") and len(line) < 80:
            flush_body()
            out.append(WeightedSection(kind=SectionKind.DEFINITION, text=line.strip().rstrip(":"), weight=weights.definition))
            continue

        body_buf.append(line)

    flush_body()
    return out
