"""First-class incremental path.

Bounded locality: single note edit touches only
  - itself (reingest, re-tfidf row)
  - its current + previous top-k neighbors
  - its current + previous topic cluster
  - adjacent confusion pairs (topics containing the note + each topic's neighbors)
  - topic rollups for those clusters
  - note_diagnostics for all impacted notes

Rest of the space is untouched.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import psycopg


@dataclass
class DeltaScope:
    changed_note_id: str
    affected_note_ids: set[str] = field(default_factory=set)
    affected_topic_ids: set[str] = field(default_factory=set)
    affected_confusion_pairs: set[tuple[str, str]] = field(default_factory=set)


def plan_delta(conn: psycopg.Connection, space_id: str, changed_note_id: str, k_hop: int = 2) -> DeltaScope:
    scope = DeltaScope(changed_note_id=changed_note_id)
    scope.affected_note_ids.add(changed_note_id)

    # direct neighbors (prior run edges) — k_hop expansion
    frontier = {changed_note_id}
    for _ in range(k_hop):
        if not frontier:
            break
        placeholders = ",".join(["%s"] * len(frontier))
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT src_note_id::text AS s, dst_note_id::text AS d
                FROM note_sim_edges
                WHERE space_id = %s AND
                      (src_note_id::text IN ({placeholders}) OR dst_note_id::text IN ({placeholders}))
                """,
                (space_id, *frontier, *frontier),
            )
            rows = cur.fetchall()
        new_frontier: set[str] = set()
        for r in rows:
            for nid in (r["s"], r["d"]):
                if nid not in scope.affected_note_ids:
                    new_frontier.add(nid)
                    scope.affected_note_ids.add(nid)
        frontier = new_frontier

    # topics touching any affected note
    if scope.affected_note_ids:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text AS id
                FROM topic_clusters
                WHERE space_id = %s
                  AND note_ids::text[] && %s::text[]
                """,
                (space_id, list(scope.affected_note_ids)),
            )
            for r in cur.fetchall():
                scope.affected_topic_ids.add(r["id"])

    # confusion pairs touching those topics
    if scope.affected_topic_ids:
        with conn.cursor() as cur:
            placeholders = ",".join(["%s"] * len(scope.affected_topic_ids))
            cur.execute(
                f"""
                SELECT topic_a::text AS a, topic_b::text AS b
                FROM confusion_pairs
                WHERE space_id = %s
                  AND (topic_a::text IN ({placeholders}) OR topic_b::text IN ({placeholders}))
                """,
                (space_id, *scope.affected_topic_ids, *scope.affected_topic_ids),
            )
            for r in cur.fetchall():
                scope.affected_confusion_pairs.add((r["a"], r["b"]))

    return scope


def apply_delta(scope: DeltaScope) -> None:
    """Reserved: delta application wired once pipeline supports partial runs."""
    raise NotImplementedError("Partial-run execution path not yet implemented")
