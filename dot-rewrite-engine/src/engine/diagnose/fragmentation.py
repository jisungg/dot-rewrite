"""Fragmentation: topic spans many notes but internal connectivity is weak."""
from __future__ import annotations

import igraph as ig


def score(g: ig.Graph, member_indices: list[int]) -> float:
    n = len(member_indices)
    if n < 2:
        return 0.0
    sub = g.subgraph(member_indices)
    max_edges = n * (n - 1) / 2
    density = sub.ecount() / max_edges if max_edges else 0.0
    avg_w = sum(sub.es["weight"]) / max(1, sub.ecount()) if sub.ecount() else 0.0
    # Fragmentation is high when many nodes but density and edge weight low.
    size_pressure = min(1.0, n / 12.0)
    return float(size_pressure * (1.0 - density) * (1.0 - avg_w))
