"""Bridge notes: high betweenness + cross-community."""
from __future__ import annotations

import igraph as ig


def betweenness(g: ig.Graph) -> list[float]:
    return list(g.betweenness(weights="weight"))


def cross_community_nodes(
    g: ig.Graph,
    communities: list[list[int]],
    between_scores: list[float],
    top_frac: float = 0.1,
) -> list[int]:
    node_comm = [-1] * g.vcount()
    for cid, members in enumerate(communities):
        for m in members:
            node_comm[m] = cid
    candidates = []
    for v in range(g.vcount()):
        nbr_comms = {node_comm[u] for u in g.neighbors(v) if node_comm[u] != node_comm[v]}
        if nbr_comms:
            candidates.append((v, between_scores[v], len(nbr_comms)))
    candidates.sort(key=lambda p: (-p[2], -p[1]))
    k = max(1, int(len(candidates) * top_frac))
    return [v for v, _, _ in candidates[:k]]
