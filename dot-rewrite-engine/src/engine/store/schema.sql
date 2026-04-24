-- Engine-owned tables. Notes table is owned by the Next.js app; these live
-- alongside it in the same Supabase Postgres database.
--
-- Design goal: every row is keyed by space_id so incremental per-note updates
-- can invalidate only affected rows without a global DELETE.

CREATE TABLE IF NOT EXISTS analysis_runs (
    id              uuid PRIMARY KEY,
    space_id        uuid NOT NULL,
    started_at      timestamptz NOT NULL,
    finished_at     timestamptz,
    status          text NOT NULL,
    note_count      int  NOT NULL DEFAULT 0,
    engine_version  text NOT NULL,
    weight_version  text NOT NULL DEFAULT '',
    config_hash     text NOT NULL DEFAULT '',
    weights_json    jsonb NOT NULL,
    health_flags    text[] NOT NULL DEFAULT '{}',
    notes           text DEFAULT ''
);
CREATE INDEX IF NOT EXISTS analysis_runs_space_idx ON analysis_runs(space_id, started_at DESC);

-- Per-note lexical state. Rebuilt per note on incremental update.
CREATE TABLE IF NOT EXISTS note_terms (
    space_id     uuid NOT NULL,
    note_id      uuid NOT NULL,
    term         text NOT NULL,
    tf           real NOT NULL,
    section_weight real NOT NULL DEFAULT 1.0,
    PRIMARY KEY (space_id, note_id, term)
);
CREATE INDEX IF NOT EXISTS note_terms_term_idx ON note_terms(space_id, term);

-- Fused note-to-note similarity edges (undirected; store src < dst).
CREATE TABLE IF NOT EXISTS note_sim_edges (
    space_id         uuid NOT NULL,
    src_note_id      uuid NOT NULL,
    dst_note_id      uuid NOT NULL,
    weight           real NOT NULL,
    components       jsonb NOT NULL DEFAULT '{}'::jsonb,
    confidence       real NOT NULL DEFAULT 0,
    views_supporting int  NOT NULL DEFAULT 0,
    PRIMARY KEY (space_id, src_note_id, dst_note_id)
);
CREATE INDEX IF NOT EXISTS note_sim_edges_src_idx ON note_sim_edges(space_id, src_note_id);
CREATE INDEX IF NOT EXISTS note_sim_edges_dst_idx ON note_sim_edges(space_id, dst_note_id);

-- Study-state multi-edge graph: similarity/prerequisite/repetition/confusion/support.
CREATE TABLE IF NOT EXISTS study_state_edges (
    space_id     uuid NOT NULL,
    src_node_id  text NOT NULL,
    dst_node_id  text NOT NULL,
    kind         text NOT NULL,
    weight       real NOT NULL,
    components   jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (space_id, src_node_id, dst_node_id, kind)
);
CREATE INDEX IF NOT EXISTS study_state_edges_kind_idx ON study_state_edges(space_id, kind);

-- Topic clusters (communities from Leiden).
CREATE TABLE IF NOT EXISTS topic_clusters (
    id                    uuid PRIMARY KEY,
    space_id              uuid NOT NULL,
    stable_id             uuid,
    label                 text,
    keywords              text[] NOT NULL DEFAULT '{}',
    note_ids              uuid[] NOT NULL DEFAULT '{}',
    centroid_terms        text[] NOT NULL DEFAULT '{}',
    role_mix              jsonb NOT NULL DEFAULT '{}'::jsonb,
    structural_certainty  real  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS topic_clusters_space_idx ON topic_clusters(space_id);

-- Subclusters (HAC within a community).
CREATE TABLE IF NOT EXISTS topic_subclusters (
    id         uuid PRIMARY KEY,
    space_id   uuid NOT NULL,
    parent_id  uuid NOT NULL REFERENCES topic_clusters(id) ON DELETE CASCADE,
    label      text,
    keywords   text[] NOT NULL DEFAULT '{}',
    note_ids   uuid[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS topic_subclusters_parent_idx ON topic_subclusters(parent_id);

-- Concept hubs: high-degree co-occurrence nodes (multi-word phrases welcome).
CREATE TABLE IF NOT EXISTS concept_hubs (
    space_id uuid NOT NULL,
    term     text NOT NULL,
    degree   int  NOT NULL,
    note_ids uuid[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (space_id, term)
);

-- Per-topic diagnostics (materialized aggregates).
CREATE TABLE IF NOT EXISTS topic_stats (
    space_id       uuid NOT NULL,
    topic_id       uuid NOT NULL,
    coverage       real NOT NULL DEFAULT 0,
    fragmentation  real NOT NULL DEFAULT 0,
    PRIMARY KEY (space_id, topic_id)
);

-- Confusion pairs between topic clusters (contrastive signal).
CREATE TABLE IF NOT EXISTS confusion_pairs (
    space_id uuid NOT NULL,
    topic_a  uuid NOT NULL,
    topic_b  uuid NOT NULL,
    score    real NOT NULL,
    closeness                real NOT NULL DEFAULT 0,
    separability             real NOT NULL DEFAULT 0,
    structural_certainty     real NOT NULL DEFAULT 0,
    interpretive_confidence  real NOT NULL DEFAULT 0,
    shared_core_terms             text[] NOT NULL DEFAULT '{}',
    discriminators_a              text[] NOT NULL DEFAULT '{}',
    discriminators_b              text[] NOT NULL DEFAULT '{}',
    shared_terms                  text[] NOT NULL DEFAULT '{}',
    missing_distinguishing_terms  text[] NOT NULL DEFAULT '{}',
    PRIMARY KEY (space_id, topic_a, topic_b)
);

-- Per-note diagnostics.
CREATE TABLE IF NOT EXISTS note_diagnostics (
    space_id        uuid NOT NULL,
    note_id         uuid NOT NULL,
    prereq_gap      real NOT NULL DEFAULT 0,
    integration     real NOT NULL DEFAULT 0,
    is_isolated     boolean NOT NULL DEFAULT false,
    is_foundational boolean NOT NULL DEFAULT false,
    is_bridge       boolean NOT NULL DEFAULT false,
    PRIMARY KEY (space_id, note_id)
);
CREATE INDEX IF NOT EXISTS note_diagnostics_note_idx ON note_diagnostics(note_id);

-- ============================================================
-- Idempotent migrations: add columns introduced after first apply.
-- Safe to run repeatedly.
-- ============================================================

ALTER TABLE analysis_runs
    ADD COLUMN IF NOT EXISTS weight_version text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS config_hash    text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS health_flags   text[] NOT NULL DEFAULT '{}';

ALTER TABLE note_sim_edges
    ADD COLUMN IF NOT EXISTS confidence       real NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS views_supporting int  NOT NULL DEFAULT 0;

ALTER TABLE topic_clusters
    ADD COLUMN IF NOT EXISTS stable_id            uuid,
    ADD COLUMN IF NOT EXISTS role_mix             jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS structural_certainty real  NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS topic_clusters_stable_idx ON topic_clusters(space_id, stable_id);

ALTER TABLE confusion_pairs
    ADD COLUMN IF NOT EXISTS closeness               real NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS separability            real NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS structural_certainty    real NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interpretive_confidence real NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shared_core_terms       text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS discriminators_a        text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS discriminators_b        text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- Production layer: explanations, run metrics, space profiles.
-- ============================================================

CREATE TABLE IF NOT EXISTS ranking_explanations (
    space_id        uuid NOT NULL,
    ranking_kind    text NOT NULL,
    subject_id      text NOT NULL,
    surfaced        boolean NOT NULL,
    calibrated      real NOT NULL,
    raw             real NOT NULL,
    top_features    jsonb NOT NULL DEFAULT '[]'::jsonb,
    suppression_reasons text[] NOT NULL DEFAULT '{}',
    gate_policy     text NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, ranking_kind, subject_id)
);
CREATE INDEX IF NOT EXISTS ranking_explanations_surfaced_idx
    ON ranking_explanations(space_id, ranking_kind, surfaced);

CREATE TABLE IF NOT EXISTS run_metrics (
    run_id                 uuid PRIMARY KEY REFERENCES analysis_runs(id) ON DELETE CASCADE,
    edge_count             int  NOT NULL DEFAULT 0,
    avg_cluster_size       real NOT NULL DEFAULT 0,
    orphan_rate            real NOT NULL DEFAULT 0,
    confusion_density      real NOT NULL DEFAULT 0,
    confidence_hist        jsonb NOT NULL DEFAULT '{}'::jsonb,
    role_mix               jsonb NOT NULL DEFAULT '{}'::jsonb,
    surfaced_counts        jsonb NOT NULL DEFAULT '{}'::jsonb,
    suppressed_counts      jsonb NOT NULL DEFAULT '{}'::jsonb,
    drift_flags            text[] NOT NULL DEFAULT '{}',
    stage_timings_ms       jsonb NOT NULL DEFAULT '{}'::jsonb,
    budget_degraded_stages text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS space_profiles (
    space_id    uuid PRIMARY KEY,
    kind        text NOT NULL,
    confidence  real NOT NULL DEFAULT 0,
    evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
