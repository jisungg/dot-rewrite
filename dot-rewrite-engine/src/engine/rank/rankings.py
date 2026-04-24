"""Ranking-first API. Every major engine output is a ranked list.

Consumers read from these ranked slices; individual diagnostic numbers are
secondary. Role-aware multipliers adjust each list to the study context.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..models import (
    ConfusionPair,
    DiagnosticResult,
    NoteRecord,
    NoteRole,
    SimilarityEdge,
    TopicCluster,
)
from ..roles import ROLE_WEIGHTS


@dataclass
class RankedItem:
    id: str
    score: float
    reasons: list[str]


def related_notes(
    note_id: str,
    edges: list[SimilarityEdge],
    notes_by_id: dict[str, NoteRecord],
    k: int = 10,
) -> list[RankedItem]:
    out: list[RankedItem] = []
    for e in edges:
        other = None
        if e.src == note_id:
            other = e.dst
        elif e.dst == note_id:
            other = e.src
        if not other:
            continue
        role = notes_by_id[other].role if other in notes_by_id and notes_by_id[other].role else NoteRole.UNCLASSIFIED
        mult = ROLE_WEIGHTS.get(role, {}).get("graph", 1.0)
        score = e.weight * mult * (0.5 + 0.5 * e.confidence)
        top_reason = max(e.components.items(), key=lambda kv: kv[1])[0] if e.components else "fused"
        out.append(RankedItem(id=other, score=score, reasons=[top_reason, f"views={e.views_supporting}"]))
    out.sort(key=lambda r: -r.score)
    return out[:k]


def foundational_notes(
    notes: list[NoteRecord],
    pagerank_scores: list[float],
    bridge_scores: list[float],
    k: int = 10,
) -> list[RankedItem]:
    out: list[RankedItem] = []
    for i, n in enumerate(notes):
        role = n.role or NoteRole.UNCLASSIFIED
        mult = ROLE_WEIGHTS.get(role, {}).get("prereq_source", 1.0)
        score = (0.7 * pagerank_scores[i] + 0.3 * bridge_scores[i]) * mult
        out.append(RankedItem(id=n.id, score=score, reasons=[f"role={role.value}"]))
    out.sort(key=lambda r: -r.score)
    return out[:k]


def weakest_topics(diag: DiagnosticResult, topics: list[TopicCluster], k: int = 5) -> list[RankedItem]:
    out: list[RankedItem] = []
    for t in topics:
        cov = diag.coverage.get(t.id, 0.0)
        frag = diag.fragmentation.get(t.id, 0.0)
        score = (1.0 - cov) * (0.6 + 0.4 * frag)
        reasons = []
        if cov < 0.35:
            reasons.append("low_coverage")
        if frag > 0.35:
            reasons.append("fragmented")
        out.append(RankedItem(id=t.id, score=score, reasons=reasons or ["ok"]))
    out.sort(key=lambda r: -r.score)
    return out[:k]


def strongest_confusion(pairs: list[ConfusionPair], k: int = 10) -> list[RankedItem]:
    out: list[RankedItem] = []
    for p in pairs:
        score = p.score * (0.4 + 0.6 * p.interpretive_confidence)
        reasons = [
            f"closeness={p.closeness:.2f}",
            f"separability={p.separability:.2f}",
            f"conf={p.interpretive_confidence:.2f}",
        ]
        out.append(RankedItem(id=f"{p.topic_a}|{p.topic_b}", score=score, reasons=reasons))
    out.sort(key=lambda r: -r.score)
    return out[:k]


def prerequisite_gaps(diag: DiagnosticResult, k: int = 10) -> list[RankedItem]:
    items = [RankedItem(id=nid, score=s, reasons=["prereq_gap"]) for nid, s in diag.prereq_gaps.items()]
    items.sort(key=lambda r: -r.score)
    return items[:k]
