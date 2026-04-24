"""k-NN graph with aggressive edge discipline.

Pipeline:
  1. Candidate pass: lexical cosine top-k per node (cheap).
  2. Fuse all components for each candidate edge.
  3. Mutual k-NN filter: keep (i,j) only if j in top-k(i) AND i in top-k(j).
  4. Multi-view confidence: count how many views (lexical, phrase, structural,
     neighborhood) clear their individual threshold. Require >= 2 unless the
     single view is very strong.
  5. Weight threshold + top-k per node cap.

Weak accidental-overlap edges die before clustering sees them.
"""
from __future__ import annotations

import numpy as np

from ..models import SimilarityEdge


def topk_from_scores(scores: np.ndarray, k: int) -> list[int]:
    if k >= len(scores):
        idx = np.argsort(-scores)
    else:
        idx = np.argpartition(-scores, k)[:k]
        idx = idx[np.argsort(-scores[idx])]
    return idx.tolist()


VIEW_THRESHOLDS = {
    "lexical": 0.12,
    "phrase": 0.08,
    "structural": 0.10,
    "neighborhood": 0.10,
}


def _view_confidence(edge: SimilarityEdge) -> tuple[int, float]:
    views = 0
    strongest = 0.0
    for name, thr in VIEW_THRESHOLDS.items():
        v = edge.components.get(name, 0.0)
        if v >= thr:
            views += 1
        strongest = max(strongest, v)
    return views, strongest


def build_knn_edges(
    fused_map: dict[tuple[int, int], SimilarityEdge],
    n_notes: int,
    k: int,
    min_weight: float,
    require_views: int = 2,
    single_view_override: float = 0.35,
    mutual: bool = True,
) -> list[SimilarityEdge]:
    adj: list[list[tuple[int, SimilarityEdge]]] = [[] for _ in range(n_notes)]
    for (i, j), edge in fused_map.items():
        views, strongest = _view_confidence(edge)
        edge.views_supporting = views
        # multi-view gate
        if views < require_views and strongest < single_view_override:
            continue
        if edge.weight < min_weight:
            continue
        # confidence: weight scaled by view breadth
        edge.confidence = float(min(1.0, edge.weight * (0.5 + 0.2 * views)))
        adj[i].append((j, edge))
        adj[j].append((i, edge))

    # per-node top-k
    topk_per_node: list[set[int]] = [set() for _ in range(n_notes)]
    for i, neigh in enumerate(adj):
        neigh.sort(key=lambda p: -p[1].weight)
        for j, _ in neigh[:k]:
            topk_per_node[i].add(j)

    kept: dict[tuple[int, int], SimilarityEdge] = {}
    for (i, j), edge in fused_map.items():
        if edge.weight < min_weight:
            continue
        if mutual:
            if j not in topk_per_node[i] or i not in topk_per_node[j]:
                continue
        else:
            if j not in topk_per_node[i] and i not in topk_per_node[j]:
                continue
        kept[(i, j)] = edge

    return list(kept.values())
