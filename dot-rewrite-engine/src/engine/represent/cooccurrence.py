"""Keyword co-occurrence graph.

Builds a term-term graph where terms that repeatedly appear in the same note
window become connected. Used for 'concept neighborhood overlap' similarity
and for extracting concept hubs.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field


@dataclass
class CoocGraph:
    node_df: Counter = field(default_factory=Counter)           # term -> note count
    edges: dict[tuple[str, str], int] = field(default_factory=dict)
    neighbors: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))


def build(token_streams: list[list[str]], window: int = 8, min_df: int = 2) -> CoocGraph:
    g = CoocGraph()
    for tokens in token_streams:
        seen_terms = set(tokens)
        for t in seen_terms:
            g.node_df[t] += 1
        for i, a in enumerate(tokens):
            lo, hi = max(0, i - window), min(len(tokens), i + window + 1)
            for j in range(lo, hi):
                if j == i:
                    continue
                b = tokens[j]
                if a == b:
                    continue
                key = (a, b) if a < b else (b, a)
                g.edges[key] = g.edges.get(key, 0) + 1

    # prune rare
    kept = {t for t, c in g.node_df.items() if c >= min_df}
    g.edges = {(a, b): c for (a, b), c in g.edges.items() if a in kept and b in kept}
    for (a, b) in g.edges:
        g.neighbors[a].add(b)
        g.neighbors[b].add(a)
    return g


def neighborhood_overlap(g: CoocGraph, terms_a: set[str], terms_b: set[str]) -> float:
    """Jaccard over union of concept neighborhoods of each note's top terms."""
    na: set[str] = set()
    nb: set[str] = set()
    for t in terms_a:
        na |= g.neighbors.get(t, set())
    for t in terms_b:
        nb |= g.neighbors.get(t, set())
    if not na and not nb:
        return 0.0
    inter = len(na & nb)
    union = len(na | nb)
    return inter / union if union else 0.0
