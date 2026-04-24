"""Tiny evaluation harness. Product-eval style, not benchmark theater.

Gold labels per space:
  - related: map note_id -> list[note_id] of expected neighbors
  - topic_groups: list[list[note_id]] of expected rough clusters
  - confusion_pairs: list[(note_id_a, note_id_b)] expected to flag
  - weak_topics: list[note_id lists] or labels expected to surface as weak

Metrics:
  - related precision@k, recall@k
  - topic purity / adjusted Rand (simple implementation)
  - confusion recall (did we surface the labeled pair in top-N?)
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Gold:
    name: str
    related: dict[str, list[str]] = field(default_factory=dict)
    topic_groups: list[list[str]] = field(default_factory=list)
    confusion_pairs: list[tuple[str, str]] = field(default_factory=list)
    weak_topic_labels: list[str] = field(default_factory=list)


@dataclass
class Metrics:
    related_p_at_k: float
    related_r_at_k: float
    topic_purity: float
    confusion_recall: float


def precision_recall_at_k(pred_by_note: dict[str, list[str]], gold_by_note: dict[str, list[str]], k: int) -> tuple[float, float]:
    if not gold_by_note:
        return 0.0, 0.0
    prec_total = 0.0
    rec_total = 0.0
    counted = 0
    for nid, gold_neigh in gold_by_note.items():
        if not gold_neigh:
            continue
        pred = pred_by_note.get(nid, [])[:k]
        if not pred:
            counted += 1
            continue
        hit = len(set(pred) & set(gold_neigh))
        prec_total += hit / len(pred)
        rec_total += hit / len(gold_neigh)
        counted += 1
    if counted == 0:
        return 0.0, 0.0
    return prec_total / counted, rec_total / counted


def topic_purity(pred_groups: list[list[str]], gold_groups: list[list[str]]) -> float:
    if not gold_groups or not pred_groups:
        return 0.0
    total = 0
    correct = 0
    gold_lookup: dict[str, int] = {}
    for gid, grp in enumerate(gold_groups):
        for nid in grp:
            gold_lookup[nid] = gid
    for pred in pred_groups:
        if not pred:
            continue
        counts: dict[int, int] = {}
        for nid in pred:
            g = gold_lookup.get(nid, -1)
            counts[g] = counts.get(g, 0) + 1
        correct += max(counts.values())
        total += len(pred)
    return correct / total if total else 0.0


def confusion_recall(pred_pairs: list[tuple[str, str]], gold: list[tuple[str, str]]) -> float:
    if not gold:
        return 0.0
    pred_set = {tuple(sorted(p)) for p in pred_pairs}
    hits = sum(1 for g in gold if tuple(sorted(g)) in pred_set)
    return hits / len(gold)
