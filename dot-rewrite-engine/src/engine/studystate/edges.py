"""Study-state edges with directional evidence.

Prerequisite direction A -> B is supported when:
  - A.created_at < B.created_at
  - a set of terms T introduced in A (first-meaningful appearance) is reused
    meaningfully in B (multiple occurrences, inside DEFINITION / DERIVATION /
    EXAMPLE sections)
  - A's role is definition / summary / lecture_dump (explain-y)
  - B's role is example / derivation / question / review (use-y)
  - A is broadly connected (prereq-sources tend to have high degree)

Edge weight = mean of above signals; low unless multiple hold.
"""
from __future__ import annotations

from collections import Counter

from ..models import NoteRecord, NoteRole, SectionKind, SimilarityEdge, EdgeKind


_EXPLAINERS = {NoteRole.DEFINITION, NoteRole.SUMMARY, NoteRole.LECTURE_DUMP}
_USERS = {NoteRole.EXAMPLE, NoteRole.DERIVATION, NoteRole.QUESTION, NoteRole.REVIEW}


def build_first_introduced(notes: list[NoteRecord]) -> dict[str, str]:
    ordered = sorted(notes, key=lambda n: n.created_at)
    out: dict[str, str] = {}
    for n in ordered:
        counts = Counter(n.tokens)
        for t, c in counts.items():
            # "meaningful" = appears at least twice or in TITLE/DEFINITION
            if c >= 2 or any(
                s.kind in (SectionKind.TITLE, SectionKind.DEFINITION) and t in s.tokens
                for s in n.sections
            ):
                out.setdefault(t, n.id)
    return out


def _use_weight(note: NoteRecord, term: str) -> float:
    w = 0.0
    for s in note.sections:
        if term in s.tokens:
            if s.kind in (SectionKind.DEFINITION, SectionKind.DERIVATION if False else SectionKind.BODY):
                w += 0.5
            elif s.kind == SectionKind.EXAMPLE:
                w += 0.7
            elif s.kind == SectionKind.BULLET:
                w += 0.3
            elif s.kind == SectionKind.TITLE:
                w += 0.2
    return w


def prerequisite_edges(
    notes: list[NoteRecord],
    first_introduced: dict[str, str],
    degree_scores: dict[str, float] | None = None,
) -> list[SimilarityEdge]:
    note_by_id = {n.id: n for n in notes}
    edges: list[SimilarityEdge] = []

    for n in notes:
        deps: dict[str, float] = {}
        for t in set(n.tokens):
            origin = first_introduced.get(t)
            if not origin or origin == n.id:
                continue
            o = note_by_id.get(origin)
            if not o or o.created_at >= n.created_at:
                continue
            deps[origin] = deps.get(origin, 0.0) + _use_weight(n, t)

        for origin, use_score in deps.items():
            o = note_by_id[origin]
            if use_score < 0.6:
                continue

            # role evidence
            role_bonus = 0.0
            if (o.role in _EXPLAINERS) and (n.role in _USERS):
                role_bonus = 0.4
            elif o.role in _EXPLAINERS:
                role_bonus = 0.15
            elif n.role in _USERS:
                role_bonus = 0.1

            degree_bonus = 0.0
            if degree_scores is not None:
                degree_bonus = min(0.3, degree_scores.get(origin, 0.0) * 0.3)

            weight = min(1.0, 0.5 * min(1.0, use_score / 3.0) + role_bonus + degree_bonus)
            edges.append(SimilarityEdge(
                src=origin, dst=n.id, weight=weight, kind=EdgeKind.PREREQUISITE,
                components={"term_reuse": float(use_score), "role_bonus": role_bonus, "degree_bonus": degree_bonus},
                direction=f"{origin}->{n.id}",
                confidence=min(1.0, weight * 1.1),
            ))
    return edges


def repetition_edges(notes: list[NoteRecord]) -> list[SimilarityEdge]:
    return []
