"""Build the semantic k-NN graph from L2-normalized embeddings.

Cosine-similarity = dot product for unit vectors. We compute the full
(N x N) similarity matrix (N is always small here — a single user's space
rarely exceeds a few hundred notes) and keep each node's top-K neighbors
above `min_similarity`. The mutual-kNN flag boosts precision for large
dense spaces; we compute it once and carry it on the edge.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

import numpy as np

from ..models import SemanticCluster, SemanticEdge


@dataclass
class SemanticGraphParams:
    k: int = 10
    min_similarity: float = 0.35
    leiden_resolution: float = 1.0
    mutual_only: bool = False


def build_edges(
    matrix: np.ndarray,
    ids: list[str],
    params: SemanticGraphParams,
) -> list[SemanticEdge]:
    n = matrix.shape[0]
    if n < 2:
        return []
    sim = matrix @ matrix.T
    np.fill_diagonal(sim, -1.0)

    k = min(params.k, n - 1)
    topk_idx: list[set[int]] = []
    for i in range(n):
        row = sim[i]
        idx = np.argpartition(row, -k)[-k:]
        topk_idx.append({int(j) for j in idx if row[j] >= params.min_similarity})

    edges: dict[tuple[int, int], SemanticEdge] = {}
    for i in range(n):
        for j in topk_idx[i]:
            if j == i:
                continue
            a, b = (i, j) if i < j else (j, i)
            if (a, b) in edges:
                continue
            mutual = i in topk_idx[j]
            if params.mutual_only and not mutual:
                continue
            s = float(sim[a, b])
            if s < params.min_similarity:
                continue
            edges[(a, b)] = SemanticEdge(
                src=ids[a], dst=ids[b], similarity=s, mutual=mutual,
            )
    return list(edges.values())


def leiden_clusters(
    ids: list[str],
    edges: list[SemanticEdge],
    space_id: str,
    resolution: float = 1.0,
) -> list[SemanticCluster]:
    if not ids:
        return []
    try:
        import igraph as ig
        import leidenalg
    except Exception:  # pragma: no cover
        return [
            SemanticCluster(id=str(uuid.uuid4()), space_id=space_id, note_ids=[nid])
            for nid in ids
        ]

    index_of = {nid: i for i, nid in enumerate(ids)}
    g = ig.Graph(n=len(ids), directed=False)
    weights: list[float] = []
    g_edges: list[tuple[int, int]] = []
    for e in edges:
        if e.src not in index_of or e.dst not in index_of:
            continue
        g_edges.append((index_of[e.src], index_of[e.dst]))
        weights.append(max(0.0, e.similarity))
    g.add_edges(g_edges)
    if weights:
        g.es["weight"] = weights

    try:
        partition = leidenalg.find_partition(
            g,
            leidenalg.CPMVertexPartition,
            weights=weights if weights else None,
            resolution_parameter=resolution,
            n_iterations=-1,
        )
        communities = list(partition)
    except Exception:
        communities = [[i for i in range(len(ids))]]

    clusters: list[SemanticCluster] = []
    for members in communities:
        nids = [ids[i] for i in members]
        cohesion = _mean_intra_similarity(g, members)
        clusters.append(
            SemanticCluster(
                id=str(uuid.uuid4()),
                space_id=space_id,
                note_ids=nids,
                cohesion=cohesion,
            )
        )
    return clusters


def _mean_intra_similarity(g, members: list[int]) -> float:
    if len(members) < 2:
        return 0.0
    member_set = set(members)
    ws: list[float] = []
    for eid in range(g.ecount()):
        s, t = g.es[eid].source, g.es[eid].target
        if s in member_set and t in member_set:
            ws.append(float(g.es[eid]["weight"] if "weight" in g.es.attributes() else 1.0))
    if not ws:
        return 0.0
    return float(sum(ws) / len(ws))


def centroid(matrix: np.ndarray, ids: list[str], note_ids: list[str]) -> list[float]:
    if not note_ids or matrix.size == 0:
        return []
    index_of = {nid: i for i, nid in enumerate(ids)}
    rows = [matrix[index_of[n]] for n in note_ids if n in index_of]
    if not rows:
        return []
    mean = np.mean(np.vstack(rows), axis=0).astype(np.float32)
    norm = float(np.linalg.norm(mean))
    if norm > 1e-12:
        mean = mean / norm
    return mean.tolist()


def label_from_keywords(keywords: list[str]) -> str:
    if not keywords:
        return "Untitled cluster"
    return " · ".join(keywords[:3])
