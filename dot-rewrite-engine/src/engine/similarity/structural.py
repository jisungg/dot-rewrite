"""Structural overlap: shared titles/headings/definition terms.

Notes that share heading vocabulary are more related than notes that only share
random body words. Computes Jaccard over the union of TITLE and DEFINITION tokens.
"""
from __future__ import annotations

from ..models import NoteRecord, SectionKind


def _heading_terms(note: NoteRecord) -> set[str]:
    out: set[str] = set()
    for s in note.sections:
        if s.kind in (SectionKind.TITLE, SectionKind.DEFINITION):
            out.update(s.tokens)
    return out


def score(a: NoteRecord, b: NoteRecord) -> float:
    ta, tb = _heading_terms(a), _heading_terms(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0
