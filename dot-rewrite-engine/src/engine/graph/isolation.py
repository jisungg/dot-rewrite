"""Orphan detection: notes with few/weak edges."""
from __future__ import annotations

import igraph as ig


def orphans(g: ig.Graph, min_degree: int = 1, min_strength: float = 0.2) -> list[int]:
    out: list[int] = []
    strengths = g.strength(weights="weight")
    for v in range(g.vcount()):
        if g.degree(v) < min_degree or strengths[v] < min_strength:
            out.append(v)
    return out
