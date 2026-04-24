"""Structural certainty vs interpretive confidence.

structural_certainty: how firm the graph evidence is. Driven by density,
repeated/stable edges, and term-signature persistence.

interpretive_confidence: how trustworthy a *label* ('weak coverage', 'confusion')
is given the evidence. A small cluster can have high certainty but low
confidence for labels that require many notes.
"""
from __future__ import annotations

import igraph as ig


def topic_structural_certainty(g: ig.Graph, members: list[int]) -> float:
    n = len(members)
    if n < 2:
        return float(min(1.0, n / 2.0))
    sub = g.subgraph(members)
    max_e = n * (n - 1) / 2
    density = sub.ecount() / max_e if max_e else 0.0
    avg_w = (sum(sub.es["weight"]) / sub.ecount()) if sub.ecount() else 0.0
    return float(0.6 * density + 0.4 * avg_w)


def coverage_interpretive_confidence(note_count: int, certainty: float) -> float:
    size_ok = min(1.0, note_count / 6.0)
    return float(0.5 * size_ok + 0.5 * certainty)


def confusion_interpretive_confidence(
    closeness: float, separability: float, certainty_a: float, certainty_b: float,
) -> float:
    base_cert = (certainty_a + certainty_b) / 2
    # low separability should NOT alone push confidence to 1 — it must match
    # with graph evidence
    return float(0.5 * base_cert + 0.5 * (closeness * (1.0 - separability)))
