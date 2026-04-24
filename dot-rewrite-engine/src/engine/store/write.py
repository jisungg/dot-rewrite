"""Write analysis outputs back to Supabase Postgres.

Tables owned by the engine (see store/schema.sql):
  analysis_runs, note_terms, note_sim_edges, study_state_edges,
  topic_clusters, topic_subclusters, concept_hubs, topic_stats,
  confusion_pairs, note_diagnostics.

Incremental-friendly: every write keyed by (space_id, ...) so partial
invalidation works.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import psycopg

from ..models import (
    AnalysisRun,
    ConfusionPair,
    DiagnosticResult,
    RankingExplanation,
    RunMetrics,
    SimilarityEdge,
    SpaceProfile,
    TopicCluster,
)


def start_run(conn: psycopg.Connection, space_id: str, engine_version: str, weights: dict) -> AnalysisRun:
    run = AnalysisRun(
        id=str(uuid.uuid4()),
        space_id=space_id,
        started_at=datetime.now(timezone.utc),
        finished_at=None,
        status="running",
        note_count=0,
        engine_version=engine_version,
        weights_json=json.dumps(weights),
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO analysis_runs
              (id, space_id, started_at, status, note_count, engine_version,
               weight_version, config_hash, weights_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (run.id, run.space_id, run.started_at, run.status, run.note_count,
             run.engine_version,
             weights.get("weight_version", ""),
             weights.get("config_hash", ""),
             run.weights_json),
        )
    return run


def finish_run(conn: psycopg.Connection, run: AnalysisRun, status: str, note_count: int, notes_text: str = "") -> None:
    run.finished_at = datetime.now(timezone.utc)
    run.status = status
    run.note_count = note_count
    run.notes = notes_text
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE analysis_runs
            SET finished_at = %s, status = %s, note_count = %s, notes = %s
            WHERE id = %s
            """,
            (run.finished_at, run.status, run.note_count, run.notes, run.id),
        )


def replace_explanations(
    conn: psycopg.Connection, space_id: str, items: list[RankingExplanation]
) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM ranking_explanations WHERE space_id = %s", (space_id,))
        cur.executemany(
            """
            INSERT INTO ranking_explanations
              (space_id, ranking_kind, subject_id, surfaced, calibrated, raw,
               top_features, suppression_reasons, gate_policy)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """,
            [(space_id, e.ranking_kind, e.subject_id, e.surfaced, e.calibrated, e.raw,
              json.dumps(e.top_features), e.suppression_reasons, e.gate_policy)
             for e in items],
        )


def replace_run_metrics(conn: psycopg.Connection, run_id: str, m: RunMetrics) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM run_metrics WHERE run_id = %s", (run_id,))
        cur.execute(
            """
            INSERT INTO run_metrics
              (run_id, edge_count, avg_cluster_size, orphan_rate, confusion_density,
               confidence_hist, role_mix, surfaced_counts, suppressed_counts,
               drift_flags, stage_timings_ms, budget_degraded_stages)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb,
                    %s, %s::jsonb, %s)
            """,
            (run_id, m.edge_count, m.avg_cluster_size, m.orphan_rate, m.confusion_density,
             json.dumps(m.confidence_hist), json.dumps(m.role_mix),
             json.dumps(m.surfaced_counts), json.dumps(m.suppressed_counts),
             m.drift_flags, json.dumps(m.stage_timings_ms), m.budget_degraded_stages),
        )


def upsert_space_profile(conn: psycopg.Connection, space_id: str, profile: SpaceProfile) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO space_profiles (space_id, kind, confidence, evidence)
            VALUES (%s, %s, %s, %s::jsonb)
            ON CONFLICT (space_id) DO UPDATE SET
              kind = EXCLUDED.kind,
              confidence = EXCLUDED.confidence,
              evidence = EXCLUDED.evidence,
              updated_at = now()
            """,
            (space_id, profile.kind.value, profile.confidence, json.dumps(profile.evidence)),
        )


def replace_sim_edges(conn: psycopg.Connection, space_id: str, edges: list[SimilarityEdge]) -> None:
    rows = []
    for e in edges:
        a, b = (e.src, e.dst) if e.src < e.dst else (e.dst, e.src)
        rows.append((space_id, a, b, e.weight, json.dumps(e.components),
                     e.confidence, e.views_supporting))
    with conn.cursor() as cur:
        cur.execute("DELETE FROM note_sim_edges WHERE space_id = %s", (space_id,))
        cur.executemany(
            """
            INSERT INTO note_sim_edges
              (space_id, src_note_id, dst_note_id, weight, components, confidence, views_supporting)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
            """,
            rows,
        )


def replace_study_edges(conn: psycopg.Connection, space_id: str, edges: list[SimilarityEdge]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM study_state_edges WHERE space_id = %s", (space_id,))
        cur.executemany(
            """
            INSERT INTO study_state_edges
              (space_id, src_node_id, dst_node_id, kind, weight, components)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            [(space_id, e.src, e.dst, e.kind.value, e.weight, json.dumps(e.components)) for e in edges],
        )


def replace_topics(conn: psycopg.Connection, space_id: str, topics: list[TopicCluster]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM topic_subclusters WHERE space_id = %s", (space_id,))
        cur.execute("DELETE FROM topic_clusters WHERE space_id = %s", (space_id,))
        for t in topics:
            cur.execute(
                """
                INSERT INTO topic_clusters
                  (id, space_id, stable_id, label, keywords, note_ids, centroid_terms,
                   role_mix, structural_certainty)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                """,
                (t.id, space_id, t.stable_id, t.label, t.keywords, t.note_ids,
                 t.centroid_terms, json.dumps(t.role_mix), t.structural_certainty),
            )
            for sc in t.subclusters:
                cur.execute(
                    """
                    INSERT INTO topic_subclusters
                      (id, space_id, parent_id, label, keywords, note_ids)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (sc.id, space_id, t.id, sc.label, sc.keywords, sc.note_ids),
                )


def replace_confusion_pairs(conn: psycopg.Connection, space_id: str, pairs: list[ConfusionPair]) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM confusion_pairs WHERE space_id = %s", (space_id,))
        cur.executemany(
            """
            INSERT INTO confusion_pairs
              (space_id, topic_a, topic_b, score, closeness, separability,
               structural_certainty, interpretive_confidence,
               shared_core_terms, discriminators_a, discriminators_b,
               shared_terms, missing_distinguishing_terms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [(space_id, p.topic_a, p.topic_b, p.score, p.closeness, p.separability,
              p.structural_certainty, p.interpretive_confidence,
              p.shared_core_terms, p.discriminators_a, p.discriminators_b,
              p.shared_terms, p.missing_distinguishing_terms)
             for p in pairs],
        )


def replace_diagnostics(conn: psycopg.Connection, diag: DiagnosticResult) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM note_diagnostics WHERE space_id = %s", (diag.space_id,))
        cur.execute("DELETE FROM topic_stats WHERE space_id = %s", (diag.space_id,))
        cur.executemany(
            """
            INSERT INTO topic_stats (space_id, topic_id, coverage, fragmentation)
            VALUES (%s, %s, %s, %s)
            """,
            [(diag.space_id, tid, diag.coverage.get(tid, 0.0), diag.fragmentation.get(tid, 0.0))
             for tid in set(diag.coverage) | set(diag.fragmentation)],
        )
        note_ids = set(diag.prereq_gaps) | set(diag.integration) | set(diag.isolation) \
                   | set(diag.foundational) | set(diag.bridges)
        cur.executemany(
            """
            INSERT INTO note_diagnostics
              (space_id, note_id, prereq_gap, integration, is_isolated, is_foundational, is_bridge)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            [(diag.space_id, nid,
              diag.prereq_gaps.get(nid, 0.0),
              diag.integration.get(nid, 0.0),
              nid in set(diag.isolation),
              nid in set(diag.foundational),
              nid in set(diag.bridges))
             for nid in note_ids],
        )
