"""Community detection via Leiden (python-igraph + leidenalg).

igraph for serious graph compute; networkx reserved for debug visualization
elsewhere.
"""
from __future__ import annotations

import igraph as ig
import leidenalg as la

from ..models import SimilarityEdge


def build_igraph(note_ids: list[str], edges: list[SimilarityEdge]) -> ig.Graph:
    idx = {nid: i for i, nid in enumerate(note_ids)}
    es = [(idx[e.src], idx[e.dst]) for e in edges if e.src in idx and e.dst in idx]
    ws = [e.weight for e in edges if e.src in idx and e.dst in idx]
    g = ig.Graph(n=len(note_ids), edges=es, directed=False)
    g.vs["note_id"] = note_ids
    g.es["weight"] = ws
    return g


def leiden(g: ig.Graph, resolution: float = 1.0) -> list[list[int]]:
    part = la.find_partition(
        g,
        la.RBConfigurationVertexPartition,
        weights="weight",
        resolution_parameter=resolution,
    )
    return [list(c) for c in part]
