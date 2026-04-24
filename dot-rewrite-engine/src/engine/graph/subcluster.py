"""Hierarchical agglomerative subclustering inside each community."""
from __future__ import annotations

import numpy as np
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import squareform


def hac(sim_matrix: np.ndarray, t: float = 0.5, min_size: int = 3) -> list[list[int]]:
    n = sim_matrix.shape[0]
    if n < min_size:
        return [list(range(n))]
    dist = 1.0 - np.clip(sim_matrix, 0.0, 1.0)
    np.fill_diagonal(dist, 0.0)
    condensed = squareform(dist, checks=False)
    Z = linkage(condensed, method="average")
    labels = fcluster(Z, t=t, criterion="distance")
    groups: dict[int, list[int]] = {}
    for i, lab in enumerate(labels):
        groups.setdefault(int(lab), []).append(i)
    return [g for g in groups.values() if len(g) >= 1]
