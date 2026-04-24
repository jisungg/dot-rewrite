"""Confusion detection: closeness / separability.

Closeness signals: cross-cluster avg edge weight, shared-core term overlap,
role-mix similarity.
Separability signals: size and distinctness of topic-specific discriminators
(terms present in A's members but not B's, phrases, example patterns).

score = closeness / separability. High when clusters sit on each other and
lack decisive distinguishing terms — the exact mix-up student-error pattern.

Structural certainty = graph evidence behind the pairing.
Interpretive confidence = how trustworthy the *confusion* label itself is.
"""
from __future__ import annotations

from dataclasses import dataclass

import igraph as ig

from ..models import ConfusionPair, NoteRecord, TopicCluster


@dataclass
class _TopicProfile:
    topic_id: str
    term_df: dict[str, int]
    phrase_df: dict[str, int]
    role_mix: dict[str, float]
    n: int


def _build_profile(topic: TopicCluster, notes_by_id: dict[str, NoteRecord]) -> _TopicProfile:
    members = [notes_by_id[nid] for nid in topic.note_ids if nid in notes_by_id]
    term_df: dict[str, int] = {}
    phrase_df: dict[str, int] = {}
    role_mix: dict[str, float] = {}
    for m in members:
        for t in set(m.tokens):
            term_df[t] = term_df.get(t, 0) + 1
        for p in set(m.phrases):
            phrase_df[p] = phrase_df.get(p, 0) + 1
        if m.role:
            role_mix[m.role.value] = role_mix.get(m.role.value, 0.0) + 1
    total = sum(role_mix.values()) or 1
    role_mix = {k: v / total for k, v in role_mix.items()}
    return _TopicProfile(topic.id, term_df, phrase_df, role_mix, len(members))


def _discriminators(a: _TopicProfile, b: _TopicProfile, top: int = 12) -> list[str]:
    """Terms that strongly mark A vs B: high relative df in A, low in B."""
    out: list[tuple[str, float]] = []
    for term, df_a in a.term_df.items():
        if a.n == 0:
            break
        p_a = df_a / a.n
        p_b = b.term_df.get(term, 0) / max(1, b.n)
        score = p_a - p_b
        if score > 0.15 and p_a >= 0.4:
            out.append((term, score))
    out.sort(key=lambda kv: -kv[1])
    return [t for t, _ in out[:top]]


def _role_mix_sim(a: dict[str, float], b: dict[str, float]) -> float:
    keys = set(a) | set(b)
    if not keys:
        return 0.0
    num = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in keys)
    import math
    da = math.sqrt(sum(v * v for v in a.values())) or 1.0
    db = math.sqrt(sum(v * v for v in b.values())) or 1.0
    return num / (da * db)


def _cross_cluster_sim(g: ig.Graph, members_a: list[int], members_b: list[int]) -> float:
    if not members_a or not members_b:
        return 0.0
    set_b = set(members_b)
    total = 0.0
    count = 0
    for v in members_a:
        for eid in g.incident(v):
            u = g.es[eid].target if g.es[eid].source == v else g.es[eid].source
            if u in set_b:
                total += float(g.es[eid]["weight"])
                count += 1
    return total / count if count else 0.0


def detect(
    topics: list[tuple[TopicCluster, list[int]]],
    notes_by_id: dict[str, NoteRecord],
    g: ig.Graph,
    *,
    min_closeness: float = 0.25,
    min_score: float = 0.55,
) -> list[ConfusionPair]:
    profiles = {t.id: _build_profile(t, notes_by_id) for t, _ in topics}
    out: list[ConfusionPair] = []

    for i in range(len(topics)):
        for j in range(i + 1, len(topics)):
            ta, mem_a = topics[i]
            tb, mem_b = topics[j]
            pa, pb = profiles[ta.id], profiles[tb.id]
            if pa.n < 2 or pb.n < 2:
                continue

            # shared-core: high-df terms present in both
            core_a = {t for t, c in pa.term_df.items() if c / pa.n >= 0.5}
            core_b = {t for t, c in pb.term_df.items() if c / pb.n >= 0.5}
            shared_core = core_a & core_b
            if not shared_core:
                continue

            union_core = core_a | core_b
            core_overlap = len(shared_core) / len(union_core)

            cross = _cross_cluster_sim(g, mem_a, mem_b)
            role_sim = _role_mix_sim(pa.role_mix, pb.role_mix)
            closeness = 0.5 * core_overlap + 0.35 * cross + 0.15 * role_sim
            if closeness < min_closeness:
                continue

            disc_a = _discriminators(pa, pb)
            disc_b = _discriminators(pb, pa)
            # separability: size and strength of each side's distinguishing set
            sep_a = min(1.0, len(disc_a) / 6.0)
            sep_b = min(1.0, len(disc_b) / 6.0)
            separability = max(0.1, (sep_a + sep_b) / 2)
            score = closeness / separability
            if score < min_score:
                continue

            structural = min(1.0, (cross * 0.7 + core_overlap * 0.3))
            interp = min(1.0, 0.5 * (1.0 - separability) + 0.5 * core_overlap)

            pair = ConfusionPair(
                topic_a=ta.id,
                topic_b=tb.id,
                score=float(score),
                closeness=float(closeness),
                separability=float(separability),
                shared_core_terms=sorted(shared_core)[:25],
                discriminators_a=disc_a,
                discriminators_b=disc_b,
                shared_terms=sorted(shared_core)[:25],
                missing_distinguishing_terms=sorted((core_a ^ core_b) - shared_core)[:20],
                structural_certainty=float(structural),
                interpretive_confidence=float(interp),
            )
            out.append(pair)

    out.sort(key=lambda p: -p.score)
    return out
