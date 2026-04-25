"""Per-note centrality + role flags.

Wraps the existing graph utilities (`engine.graph.{centrality,bridge,
isolation}`) and emits one `NoteMetric` row per note with PageRank,
betweenness, degree, plus the boolean role flags consumed by the Nexus
insights stage:

  - is_god_node    : top-K (default 10%) by PageRank ∪ degree
  - is_bridge      : produced by bridge.cross_community_nodes
  - is_orphan      : produced by isolation.orphans
  - is_cut_vertex  : igraph articulation points

`community_id` carries the semantic-cluster `stable_id` (or fallback id)
the note belongs to, so the web layer can join metrics to clusters
without a second round-trip.

Operates over the SEMANTIC graph (the primary signal) when present,
otherwise falls back to the fused similarity graph.
"""
from __future__ import annotations

import logging
from collections import defaultdict

import igraph as ig

from ..graph import bridge as graph_bridge
from ..graph import centrality as graph_centrality
from ..graph import isolation as graph_isolation
from ..models import NoteMetric, NoteRecord, SemanticCluster, SemanticEdge

log = logging.getLogger("engine.extract.centrality")


def _build_graph(
    note_ids: list[str], edges: list[SemanticEdge]
) -> tuple[ig.Graph, dict[str, int]]:
    idx = {nid: i for i, nid in enumerate(note_ids)}
    es: list[tuple[int, int]] = []
    ws: list[float] = []
    for e in edges:
        if e.src in idx and e.dst in idx and e.src != e.dst:
            es.append((idx[e.src], idx[e.dst]))
            ws.append(max(0.001, float(e.similarity)))
    g = ig.Graph(n=len(note_ids), edges=es, directed=False)
    g.vs["note_id"] = note_ids
    g.es["weight"] = ws
    return g, idx


def _articulation(g: ig.Graph) -> set[int]:
    if g.vcount() == 0 or g.ecount() == 0:
        return set()
    try:
        return set(g.articulation_points())
    except Exception:
        return set()


def compute_metrics(
    notes: list[NoteRecord],
    semantic_edges: list[SemanticEdge],
    semantic_clusters: list[SemanticCluster],
    god_top_frac: float = 0.1,
    god_min: int = 1,
    bridge_top_frac: float = 0.1,
) -> list[NoteMetric]:
    if not notes:
        return []

    note_ids = [n.id for n in notes]
    g, idx = _build_graph(note_ids, semantic_edges)

    if g.ecount() == 0:
        # Every note is an orphan when there are no edges. Return defaults.
        return [
            NoteMetric(
                space_id=n.space_id,
                note_id=n.id,
                degree=0,
                pagerank=0.0,
                betweenness=0.0,
                is_god_node=False,
                is_bridge=False,
                is_orphan=True,
                is_cut_vertex=False,
                community_id=None,
            )
            for n in notes
        ]

    pr = graph_centrality.pagerank(g)
    bw = graph_bridge.betweenness(g)
    degrees = g.degree()

    communities: list[list[int]] = []
    cluster_id_by_note: dict[str, str] = {}
    if semantic_clusters:
        for c in semantic_clusters:
            members = [idx[nid] for nid in c.note_ids if nid in idx]
            if members:
                communities.append(members)
            cid = c.stable_id or c.id
            for nid in c.note_ids:
                cluster_id_by_note[nid] = cid
    else:
        # Fall back to a single community covering everything.
        communities = [list(range(len(note_ids)))]

    bridge_v = (
        graph_bridge.cross_community_nodes(g, communities, bw, top_frac=bridge_top_frac)
        if len(communities) > 1
        else []
    )
    bridge_set = set(bridge_v)
    orphan_set = set(graph_isolation.orphans(g))

    # God = top-K by combined PR + degree percentile.
    n = len(note_ids)
    k = max(god_min, int(n * god_top_frac))
    combined = [(0.7 * pr[i] + 0.3 * (degrees[i] / max(1, n - 1)), i) for i in range(n)]
    combined.sort(reverse=True)
    god_set = {i for _, i in combined[:k]}

    cut_set = _articulation(g)

    space_id_by_note = {n.id: n.space_id for n in notes}
    metrics: list[NoteMetric] = []
    for i, nid in enumerate(note_ids):
        metrics.append(
            NoteMetric(
                space_id=space_id_by_note[nid],
                note_id=nid,
                degree=int(degrees[i]),
                pagerank=float(pr[i]),
                betweenness=float(bw[i]),
                is_god_node=i in god_set,
                is_bridge=i in bridge_set,
                is_orphan=i in orphan_set,
                is_cut_vertex=i in cut_set,
                community_id=cluster_id_by_note.get(nid),
            )
        )
    return metrics


def god_and_bridge_note_ids(metrics: list[NoteMetric]) -> list[str]:
    """Convenience: union of god ∪ bridge note ids."""
    return [m.note_id for m in metrics if m.is_god_node or m.is_bridge]
