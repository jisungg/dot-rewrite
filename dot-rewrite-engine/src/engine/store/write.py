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
    ConceptMention,
    ConfusionPair,
    DiagnosticResult,
    HierarchyPath,
    NexusInsight,
    NoteEmbedding,
    NoteMetric,
    NoteSpan,
    RankingExplanation,
    RunMetrics,
    SemanticCluster,
    SemanticEdge,
    SimilarityEdge,
    SpaceProfile,
    TopicCluster,
    TypedRelation,
    UngroupedNote,
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


def upsert_embeddings(
    conn: psycopg.Connection,
    space_id: str,
    embeddings: dict[str, NoteEmbedding],
    live_note_ids: set[str],
) -> None:
    """Upsert supplied embeddings and delete rows for notes that no longer exist."""
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO note_embeddings
              (space_id, note_id, model, dim, vector, content_hash)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (space_id, note_id) DO UPDATE SET
              model = EXCLUDED.model,
              dim = EXCLUDED.dim,
              vector = EXCLUDED.vector,
              content_hash = EXCLUDED.content_hash,
              created_at = now()
            """,
            [
                (space_id, e.note_id, e.model, e.dim, list(e.vector), e.content_hash)
                for e in embeddings.values()
            ],
        )
        if live_note_ids:
            cur.execute(
                """
                DELETE FROM note_embeddings
                 WHERE space_id = %s
                   AND NOT (note_id::text = ANY(%s))
                """,
                (space_id, list(live_note_ids)),
            )


def replace_semantic_edges(
    conn: psycopg.Connection, space_id: str, edges: list[SemanticEdge]
) -> None:
    rows = []
    for e in edges:
        a, b = (e.src, e.dst) if e.src < e.dst else (e.dst, e.src)
        rows.append((space_id, a, b, e.similarity, bool(e.mutual)))
    with conn.cursor() as cur:
        cur.execute("DELETE FROM note_semantic_edges WHERE space_id = %s", (space_id,))
        cur.executemany(
            """
            INSERT INTO note_semantic_edges
              (space_id, src_note_id, dst_note_id, similarity, mutual)
            VALUES (%s, %s, %s, %s, %s)
            """,
            rows,
        )


def replace_semantic_clusters(
    conn: psycopg.Connection, space_id: str, clusters: list[SemanticCluster]
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM semantic_topic_clusters WHERE space_id = %s", (space_id,)
        )
        for c in clusters:
            cur.execute(
                """
                INSERT INTO semantic_topic_clusters
                  (id, space_id, stable_id, label, keywords, note_ids, centroid, cohesion,
                   parent_topic, hierarchy_path, evidence_terms, excluded_terms,
                   secondary_topics, llm_confidence, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    c.id, space_id, c.stable_id, c.label, c.keywords, c.note_ids,
                    list(c.centroid), c.cohesion,
                    c.parent_topic, list(c.hierarchy_path),
                    list(c.evidence_terms), list(c.excluded_terms),
                    list(c.secondary_topics), c.llm_confidence, c.source,
                ),
            )


def replace_topic_hierarchy(
    conn: psycopg.Connection, space_id: str, paths: list[HierarchyPath]
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM topic_hierarchy_paths WHERE space_id = %s", (space_id,)
        )
        seen: set[tuple[str, ...]] = set()
        rows = []
        for p in paths:
            key = tuple(p.path)
            if not key or key in seen:
                continue
            seen.add(key)
            rows.append((space_id, list(p.path)))
        cur.executemany(
            "INSERT INTO topic_hierarchy_paths (space_id, path) VALUES (%s, %s)",
            rows,
        )


def replace_ungrouped_notes(
    conn: psycopg.Connection, space_id: str, items: list[UngroupedNote]
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM ungrouped_notes WHERE space_id = %s", (space_id,)
        )
        cur.executemany(
            """
            INSERT INTO ungrouped_notes (space_id, note_id, title, reason)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (space_id, note_id) DO UPDATE SET
              title = EXCLUDED.title,
              reason = EXCLUDED.reason
            """,
            [(space_id, u.note_id, u.title, u.reason) for u in items],
        )


def mark_notes_processed(
    conn: psycopg.Connection,
    space_id: str,
    started_at=None,
) -> int:
    """Flip notes.processed=true for unprocessed, unarchived rows in the space.

    Race guard (`started_at`): if a user edited a note AFTER the engine
    started, `last_modified_at` advanced past `started_at`. We only mark
    rows whose last edit was at or before the engine started, so a
    user's mid-run edit doesn't get falsely flagged as processed.
    """
    sql = (
        "UPDATE notes "
        "   SET processed = true "
        " WHERE space_id = %s "
        "   AND COALESCE(archived, false) = false "
        "   AND COALESCE(processed, false) = false"
    )
    args: list = [space_id]
    if started_at is not None:
        sql += " AND last_modified_at <= %s"
        args.append(started_at)
    with conn.cursor() as cur:
        cur.execute(sql, tuple(args))
        return cur.rowcount or 0


def replace_note_spans(
    conn: psycopg.Connection, space_id: str, spans: list[NoteSpan]
) -> None:
    """Drop all spans for the space; reinsert the fresh batch."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM note_spans WHERE space_id = %s", (space_id,))
        if not spans:
            return
        cur.executemany(
            """
            INSERT INTO note_spans
              (id, space_id, note_id, kind, depth, text,
               char_start, char_end, parent_span_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    s.id, s.space_id, s.note_id, s.kind.value, s.depth,
                    s.text, s.char_start, s.char_end, s.parent_span_id,
                )
                for s in spans
            ],
        )


def replace_concept_mentions(
    conn: psycopg.Connection, space_id: str, mentions: list[ConceptMention]
) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM concept_mentions WHERE space_id = %s", (space_id,))
        if not mentions:
            return
        cur.executemany(
            """
            INSERT INTO concept_mentions
              (space_id, note_id, span_id, surface, lemma, concept_key,
               pos, is_entity, ent_label)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    m.space_id, m.note_id, m.span_id, m.surface, m.lemma,
                    m.concept_key, m.pos, m.is_entity, m.ent_label,
                )
                for m in mentions
            ],
        )


def replace_typed_relations(
    conn: psycopg.Connection, space_id: str, relations: list[TypedRelation]
) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM typed_relations WHERE space_id = %s", (space_id,))
        if not relations:
            return
        cur.executemany(
            """
            INSERT INTO typed_relations
              (space_id, src_note_id, dst_note_id, src_concept_key, dst_concept_key,
               relation, evidence, source, confidence)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    r.space_id, r.src_note_id, r.dst_note_id,
                    r.src_concept_key, r.dst_concept_key,
                    r.relation.value, r.evidence, r.source, float(r.confidence),
                )
                for r in relations
            ],
        )


def replace_note_metrics(
    conn: psycopg.Connection, space_id: str, metrics: list[NoteMetric]
) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM note_metrics WHERE space_id = %s", (space_id,))
        if not metrics:
            return
        cur.executemany(
            """
            INSERT INTO note_metrics
              (space_id, note_id, degree, pagerank, betweenness,
               is_god_node, is_bridge, is_orphan, is_cut_vertex, community_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    m.space_id, m.note_id, m.degree, float(m.pagerank), float(m.betweenness),
                    m.is_god_node, m.is_bridge, m.is_orphan, m.is_cut_vertex, m.community_id,
                )
                for m in metrics
            ],
        )


def replace_nexus_insights(
    conn: psycopg.Connection, space_id: str, insights: list[NexusInsight]
) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM nexus_insights WHERE space_id = %s", (space_id,))
        if not insights:
            return
        cur.executemany(
            """
            INSERT INTO nexus_insights
              (space_id, kind, payload, score)
            VALUES (%s, %s, %s::jsonb, %s)
            """,
            [
                (i.space_id, i.kind.value, json.dumps(i.payload), float(i.score))
                for i in insights
            ],
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
