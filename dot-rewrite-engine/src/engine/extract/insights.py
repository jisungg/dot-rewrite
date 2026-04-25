"""Materialize Nexus insight cards from upstream extraction artifacts.

Seven insight kinds are produced. Each card scores in [0, 1] roughly
combining structural importance, recency, and (where applicable) the
typed-relation confidence behind the card.

  bridge        — note is the only path between two communities
  god           — anchor note (high PageRank + degree)
  orphan        — disconnected note (no neighbors / weak strength)
  contradiction — typed_relation 'contradicts' between two notes
  chain         — depends_on chain of length ≥ 3
  reach         — concept appears in ≥ 3 distinct communities
  emerging      — community formed from notes whose median
                  last_modified_at is in the last 14 days

Top 25 cards per kind are kept. Older cards for the same space are
DELETEd by the writer before this batch is inserted.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from ..models import (
    ConceptMention,
    InsightKind,
    NexusInsight,
    NoteMetric,
    NoteRecord,
    RelationKind,
    SemanticCluster,
    TypedRelation,
)

log = logging.getLogger("engine.extract.insights")


_PER_KIND_LIMIT = 25
_EMERGING_WINDOW_DAYS = 14
_REACH_MIN_COMMUNITIES = 3
_CHAIN_MIN_LEN = 3


def _recency_weight(updated: datetime | None, now: datetime) -> float:
    if not updated:
        return 0.5
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    age_days = max(0.0, (now - updated).total_seconds() / 86400.0)
    return float(max(0.1, min(1.0, 1.0 - (age_days / 60.0))))


def _community_of(metrics_by_note: dict[str, NoteMetric], note_id: str) -> str | None:
    m = metrics_by_note.get(note_id)
    return m.community_id if m else None


def _bridges(
    metrics: list[NoteMetric],
    notes_by_id: dict[str, NoteRecord],
    space_id: str,
    now: datetime,
) -> list[NexusInsight]:
    cards: list[NexusInsight] = []
    for m in metrics:
        if m.space_id != space_id or not m.is_bridge:
            continue
        n = notes_by_id.get(m.note_id)
        if n is None:
            continue
        score = float(min(1.0, 0.6 + m.betweenness)) * _recency_weight(n.updated_at, now)
        cards.append(
            NexusInsight(
                space_id=space_id,
                kind=InsightKind.BRIDGE,
                payload={
                    "note_id": m.note_id,
                    "title": n.title or "",
                    "betweenness": m.betweenness,
                    "community_id": m.community_id,
                },
                score=score,
            )
        )
    cards.sort(key=lambda c: c.score, reverse=True)
    return cards[:_PER_KIND_LIMIT]


def _gods(
    metrics: list[NoteMetric],
    notes_by_id: dict[str, NoteRecord],
    space_id: str,
    now: datetime,
) -> list[NexusInsight]:
    cards: list[NexusInsight] = []
    for m in metrics:
        if m.space_id != space_id or not m.is_god_node:
            continue
        n = notes_by_id.get(m.note_id)
        if n is None:
            continue
        score = float(min(1.0, 0.5 + m.pagerank * 50.0 + m.degree / 50.0)) * _recency_weight(n.updated_at, now)
        cards.append(
            NexusInsight(
                space_id=space_id,
                kind=InsightKind.GOD,
                payload={
                    "note_id": m.note_id,
                    "title": n.title or "",
                    "pagerank": m.pagerank,
                    "degree": m.degree,
                    "community_id": m.community_id,
                },
                score=min(1.0, score),
            )
        )
    cards.sort(key=lambda c: c.score, reverse=True)
    return cards[:_PER_KIND_LIMIT]


def _orphans(
    metrics: list[NoteMetric],
    notes_by_id: dict[str, NoteRecord],
    space_id: str,
    now: datetime,
) -> list[NexusInsight]:
    items: list[dict] = []
    for m in metrics:
        if m.space_id != space_id or not m.is_orphan:
            continue
        n = notes_by_id.get(m.note_id)
        if n is None:
            continue
        items.append({"note_id": m.note_id, "title": n.title or ""})
    if not items:
        return []
    return [
        NexusInsight(
            space_id=space_id,
            kind=InsightKind.ORPHAN,
            payload={"notes": items[:200], "count": len(items)},
            score=min(1.0, 0.3 + len(items) / 100.0),
        )
    ]


def _contradictions(
    relations: list[TypedRelation],
    notes_by_id: dict[str, NoteRecord],
    space_id: str,
    now: datetime,
) -> list[NexusInsight]:
    cards: list[NexusInsight] = []
    for r in relations:
        if r.space_id != space_id or r.relation != RelationKind.CONTRADICTS:
            continue
        if not r.src_note_id or not r.dst_note_id:
            continue
        a = notes_by_id.get(r.src_note_id)
        b = notes_by_id.get(r.dst_note_id)
        if not a or not b:
            continue
        rec = max(_recency_weight(a.updated_at, now), _recency_weight(b.updated_at, now))
        score = float(r.confidence) * rec
        cards.append(
            NexusInsight(
                space_id=space_id,
                kind=InsightKind.CONTRADICTION,
                payload={
                    "src_note_id": r.src_note_id,
                    "dst_note_id": r.dst_note_id,
                    "src_title": a.title or "",
                    "dst_title": b.title or "",
                    "evidence": r.evidence,
                    "confidence": r.confidence,
                    "source": r.source,
                },
                score=score,
            )
        )
    cards.sort(key=lambda c: c.score, reverse=True)
    return cards[:_PER_KIND_LIMIT]


def _chains(
    relations: list[TypedRelation],
    notes_by_id: dict[str, NoteRecord],
    space_id: str,
) -> list[NexusInsight]:
    """depends_on chains of length >= 3 (a → b → c)."""
    fwd: dict[str, set[str]] = defaultdict(set)
    for r in relations:
        if r.space_id != space_id or r.relation != RelationKind.DEPENDS_ON:
            continue
        if r.src_note_id and r.dst_note_id:
            fwd[r.src_note_id].add(r.dst_note_id)
    if not fwd:
        return []

    chains: list[list[str]] = []
    seen: set[tuple[str, ...]] = set()

    def walk(path: list[str], depth_left: int) -> None:
        if depth_left <= 0:
            return
        last = path[-1]
        for nxt in fwd.get(last, ()):
            if nxt in path:
                continue
            new_path = path + [nxt]
            walk(new_path, depth_left - 1)
            if len(new_path) >= _CHAIN_MIN_LEN:
                key = tuple(new_path)
                if key not in seen:
                    seen.add(key)
                    chains.append(new_path)

    for src in list(fwd.keys()):
        walk([src], depth_left=4)

    cards: list[NexusInsight] = []
    chains.sort(key=lambda c: -len(c))
    for c in chains[: _PER_KIND_LIMIT * 2]:
        titles = [(notes_by_id[nid].title or "") if nid in notes_by_id else "" for nid in c]
        cards.append(
            NexusInsight(
                space_id=space_id,
                kind=InsightKind.CHAIN,
                payload={"note_ids": c, "titles": titles, "length": len(c)},
                score=min(1.0, 0.4 + 0.1 * len(c)),
            )
        )
    return cards[:_PER_KIND_LIMIT]


def _reach(
    mentions: list[ConceptMention],
    metrics: list[NoteMetric],
    space_id: str,
) -> list[NexusInsight]:
    metrics_by_note = {m.note_id: m for m in metrics if m.space_id == space_id}
    by_concept: dict[str, set[str]] = defaultdict(set)  # concept_key -> set of community_id
    surface_by_concept: dict[str, str] = {}
    notes_by_concept: dict[str, set[str]] = defaultdict(set)
    for m in mentions:
        if m.space_id != space_id:
            continue
        comm = _community_of(metrics_by_note, m.note_id)
        if comm:
            by_concept[m.concept_key].add(comm)
        notes_by_concept[m.concept_key].add(m.note_id)
        surface_by_concept.setdefault(m.concept_key, m.surface or m.lemma)

    cards: list[NexusInsight] = []
    for key, comms in by_concept.items():
        if len(comms) < _REACH_MIN_COMMUNITIES:
            continue
        cards.append(
            NexusInsight(
                space_id=space_id,
                kind=InsightKind.REACH,
                payload={
                    "concept_key": key,
                    "surface": surface_by_concept.get(key, key),
                    "communities": sorted(comms),
                    "note_count": len(notes_by_concept.get(key, set())),
                },
                score=min(1.0, 0.4 + 0.15 * len(comms)),
            )
        )
    cards.sort(key=lambda c: c.score, reverse=True)
    return cards[:_PER_KIND_LIMIT]


def _emerging(
    clusters: list[SemanticCluster],
    notes_by_id: dict[str, NoteRecord],
    space_id: str,
    now: datetime,
) -> list[NexusInsight]:
    cards: list[NexusInsight] = []
    cutoff = now - timedelta(days=_EMERGING_WINDOW_DAYS)
    for c in clusters:
        if c.space_id != space_id or len(c.note_ids) < 2:
            continue
        timestamps: list[datetime] = []
        for nid in c.note_ids:
            n = notes_by_id.get(nid)
            if n and n.updated_at:
                u = n.updated_at if n.updated_at.tzinfo else n.updated_at.replace(tzinfo=timezone.utc)
                timestamps.append(u)
        if not timestamps:
            continue
        timestamps.sort()
        median = timestamps[len(timestamps) // 2]
        if median < cutoff:
            continue
        cards.append(
            NexusInsight(
                space_id=space_id,
                kind=InsightKind.EMERGING,
                payload={
                    "cluster_id": c.id,
                    "label": c.label,
                    "keywords": list(c.keywords)[:6],
                    "note_count": len(c.note_ids),
                },
                score=min(1.0, 0.5 + (len(c.note_ids) / 30.0)),
            )
        )
    cards.sort(key=lambda c: c.score, reverse=True)
    return cards[:_PER_KIND_LIMIT]


def materialize(
    space_id: str,
    notes: list[NoteRecord],
    semantic_clusters: list[SemanticCluster],
    metrics: list[NoteMetric],
    relations: list[TypedRelation],
    mentions: list[ConceptMention],
    now: datetime | None = None,
) -> list[NexusInsight]:
    now = now or datetime.now(timezone.utc)
    notes_by_id = {n.id: n for n in notes if n.space_id == space_id}

    cards: list[NexusInsight] = []
    cards.extend(_bridges(metrics, notes_by_id, space_id, now))
    cards.extend(_gods(metrics, notes_by_id, space_id, now))
    cards.extend(_orphans(metrics, notes_by_id, space_id, now))
    cards.extend(_contradictions(relations, notes_by_id, space_id, now))
    cards.extend(_chains(relations, notes_by_id, space_id))
    cards.extend(_reach(mentions, metrics, space_id))
    cards.extend(_emerging(semantic_clusters, notes_by_id, space_id, now))
    return cards
