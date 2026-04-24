# dot-rewrite-engine

Python 3.12 analysis engine. One script. No service, no queue, no worker.
Sibling of `dot-rewrite-web/` in monorepo root.

## What it do

Read all notes in a space from Supabase Postgres. Build hybrid similarity
graph. Detect topics. Score coverage, fragmentation, confusion pairs,
prereq gaps, foundational notes, orphans. Write results back. Web app read
those results.

Pure algorithmic. No embeddings. No hosted model. TF-IDF cosine + phrase
overlap + structural overlap + co-occurrence neighborhood overlap + recency
→ fused weighted k-NN graph → Leiden communities + HAC subclusters.

## Stack

- Python 3.12, `uv`
- psycopg3 → Supabase Postgres
- scikit-learn (TF-IDF, HAC, cosine), scipy, numpy
- python-igraph + leidenalg (core graph + community)
- networkx (debug inspection only)
- gensim (phrase mining), nltk (stopwords + stem fallback)
- spaCy `en_core_web_sm` optional; Snowball fallback

## Install

```bash
uv sync
cp .env.example .env                  # fill SUPABASE_DB_URL
psql "$SUPABASE_DB_URL" -f src/engine/store/schema.sql
# optional (better lemmas):
uv run python -m spacy download en_core_web_sm
# optional (nicer stopword list):
uv run python -c "import nltk; nltk.download('stopwords')"
```

## Run

```bash
uv run python analyze_space.py --space-id <uuid>
```

## Pipeline

```
fetch → ingest → roles → safeguards.audit → classify space profile
→ adjust fusion/graph/gate per profile → represent (TF-IDF + cooc)
→ similarity fuse → k-NN (mutual + multi-view confidence)
→ Leiden + HAC → directional prereq edges → topic identity alignment
→ diagnose (coverage/fragmentation/confusion/prereq/integration/negative)
→ calibrate + hard gates + explanations → drift metrics
→ write back
```

Every stage wrapped in `budget.run_stage` — timeout or exception degrade
gracefully, run still complete, degraded list recorded.

## Layout

```
src/engine/
  config.py          versioned weight preset + config hash
  models.py          NoteRecord, SimilarityEdge, TopicCluster, ConfusionPair, ...
  db.py              psycopg connect
  roles.py           rule-based NoteRole classifier + role weights
  safeguards.py      sparse / repetitive / giant / mixed-classes / glossary flags
  space_profile.py   7 profile kinds + per-profile presets
  calibration.py     per-space percentile + regime damping + floor
  gates.py           hard output gate policies (related/confusion/weakness/...)
  explain.py         feature-store snapshot per ranking emission
  drift.py           run metrics + z-score vs baseline
  budget.py          stage budgets + fail-soft
  presets.py         frozen golden_v1 + FeatureFlags
  ingest/            normalize, stopwords, lemmatize, phrases, sections, canonical
  represent/         lexical (TF-IDF + BM25 hook), cooccurrence
  similarity/        lexical, phrase, structural, neighborhood, recency, fuse
  graph/             knn (mutual + multi-view), community (Leiden),
                     subcluster (HAC), centrality, bridge, isolation
  studystate/        nodes, directional prereq edges
  topics/            identity alignment across runs
  diagnose/          coverage, fragmentation, confusion, prereq_gap,
                     integration, negative, confidence
  incremental/       bounded-locality delta scope from DB
  compress/          rollup + topic signatures (discriminator-aware)
  rank/              ranking-first API (related/foundational/weakness/...)
  eval/              gold-label harness (P@k, R@k, purity, confusion recall)
  pipeline/runner.py orchestrator
  store/             read, write, schema.sql
analyze_space.py     CLI entrypoint
tests/               smoke + extensive + production tests
```

## Engine-owned tables

Live in same Supabase as `notes`:

- `analysis_runs`        — run metadata + config_hash + weight_version
- `note_terms`           — per-note lexical state (incremental-friendly)
- `note_sim_edges`       — fused k-NN edges + confidence + views_supporting
- `study_state_edges`    — similarity/prereq/repetition/confusion/support/mismatch
- `topic_clusters`       — Leiden communities + stable_id + role_mix + certainty
- `topic_subclusters`    — HAC subtopics
- `concept_hubs`         — high-degree co-occurrence concepts
- `topic_stats`          — materialized coverage + fragmentation
- `confusion_pairs`      — closeness / separability / discriminators
- `note_diagnostics`     — per-note prereq_gap / integration / flags
- `ranking_explanations` — surfaced or suppressed + top_features + reasons
- `run_metrics`          — edge_count, confidence_hist, drift_flags, timings
- `space_profiles`       — classified space profile + evidence

All keyed by `space_id` so single-note change invalidate only local rows.

## Tests

```bash
uv run pytest -q                                            # all 26
uv run pytest tests/test_extensive.py -s -q                 # per-space reports
uv run pytest tests/test_production.py -s -q                # full prod reports
uv run pytest "tests/test_production.py::test_production_pipeline[mixed_subject-mixed_subject]" -s -q
```

## Feature flags

All production layers toggle via env. Defaults = golden_v1 on.

```
ENGINE_FLAG_PROFILE=1         space profile adaptation
ENGINE_FLAG_GATES=1           hard output gates
ENGINE_FLAG_CALIBRATION=1     score calibration
ENGINE_FLAG_DRIFT=1           drift monitoring
ENGINE_FLAG_BUDGETS=1         stage budgets + fail-soft
ENGINE_FLAG_TIMEOUTS=0        SIGALRM stage timeouts (off by default)
ENGINE_FLAG_EXPLAIN=1         write ranking_explanations rows
ENGINE_FLAG_EXP_BM25=0        experimental BM25 blend
ENGINE_FLAG_EXP_RECENCY=0     experimental recency boost
```

## Reapply schema after pull

```bash
psql "$SUPABASE_DB_URL" -f src/engine/store/schema.sql
```

Idempotent. `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
Safe to re-run.
