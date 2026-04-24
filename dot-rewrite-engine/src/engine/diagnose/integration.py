"""Integration score: how well a new note attaches to the existing topic graph."""
from __future__ import annotations

import igraph as ig


def score(g: ig.Graph, note_indices: list[int]) -> dict[int, float]:
    strengths = g.strength(weights="weight")
    degrees = g.degree()
    out: dict[int, float] = {}
    for v in note_indices:
        strength_component = min(1.0, strengths[v] / 3.0)
        degree_component = min(1.0, degrees[v] / 6.0)
        out[v] = float(0.6 * strength_component + 0.4 * degree_component)
    return out
