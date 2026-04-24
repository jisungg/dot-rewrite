"""Centrality → foundational notes."""
from __future__ import annotations

import igraph as ig


def pagerank(g: ig.Graph, damping: float = 0.85) -> list[float]:
    return list(g.personalized_pagerank(weights="weight", damping=damping))


def eigenvector(g: ig.Graph) -> list[float]:
    return list(g.eigenvector_centrality(weights="weight"))
