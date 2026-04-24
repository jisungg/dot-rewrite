"""Prerequisite gap: advanced note depends on concepts with weak earlier support."""
from __future__ import annotations

from ..models import NoteRecord, SimilarityEdge, EdgeKind


def score(
    notes: list[NoteRecord],
    prereq_edges: list[SimilarityEdge],
    coverage_by_note: dict[str, float],
) -> dict[str, float]:
    """Per-note score in [0,1]: 1 = heavy reliance on thinly-covered prereqs."""
    by_target: dict[str, list[SimilarityEdge]] = {}
    for e in prereq_edges:
        if e.kind != EdgeKind.PREREQUISITE:
            continue
        by_target.setdefault(e.dst, []).append(e)

    result: dict[str, float] = {}
    for n in notes:
        deps = by_target.get(n.id, [])
        if not deps:
            result[n.id] = 0.0
            continue
        total_w = sum(e.weight for e in deps) or 1.0
        weak = 0.0
        for e in deps:
            cov = coverage_by_note.get(e.src, 0.0)
            weak += e.weight * (1.0 - cov)
        result[n.id] = float(weak / total_w)
    return result
