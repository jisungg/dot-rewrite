# dot-rewrite-engine

Python 3.12 analysis engine. One script. No service, no queue, no worker.
Sibling of `dot-rewrite-web/` in monorepo root.

## What it do

Read all notes in a space from Supabase Postgres. Build hybrid + semantic
similarity graph. Detect topics. Score coverage, fragmentation, confusion
pairs, prereq gaps, foundational notes, orphans. Extract a deeper Nexus
intelligence layer (markdown spans, concepts, typed relations, centrality
+ role flags, insight cards) and classify each note by academic
discipline (M / S / C / P / H). Write everything back. Web app read.

Two signal layers:
- **Lexical / algorithmic**: TF-IDF cosine + phrase overlap + structural
  overlap + co-occurrence neighborhood overlap + recency → fused
  weighted k-NN graph → Leiden communities + HAC subclusters.
- **Semantic**: sentence-transformer embeddings → cosine similarity
  k-NN → Leiden communities (primary signal). Used for centrality + the
  Nexus intelligence stages.

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
→ semantic encode → semantic k-NN → semantic Leiden
→ Leiden + HAC → directional prereq edges → topic identity alignment

  --- Nexus intelligence layer ---
→ markdown AST extraction      (mistune → note_spans)
→ concept extraction           (spaCy → concept_mentions)
→ spaCy typed relations        (dep patterns → typed_relations)
→ centrality + role flags      (PageRank, betweenness, articulation
                                points → note_metrics god/bridge/orphan/cut)
→ discipline classification    (lexicon + cluster signal → note_metrics
                                .discipline ∈ {M,S,C,P,H,null})
→ LLM typed relations          (god ∪ bridge notes only, prompt-injection
                                guarded → typed_relations source='llm')
→ insight materializer         (7 kinds → nexus_insights, top 25/kind)

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
  embed/             sentence-transformer encode + cosine k-NN + Leiden
  extract/           Nexus intelligence:
                       markdown_ast, concept_extract, relation_spacy,
                       centrality (role flags), relation_llm, insights
  letters/           per-discipline agents:
                       discipline (classifier), manifest.json (sources),
                       seeds/bootstrap.jsonl (seed corpus)
  pipeline/runner.py orchestrator
  store/             read, write, schema.sql
scripts/
  seed_letter_corpus.py  embed + upsert seeded corpus into letter_corpus
analyze_space.py     CLI entrypoint
tests/               smoke + extensive + production + nexus_extract tests
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
- `note_embeddings`      — per-note sentence-transformer vectors (real[])
- `note_semantic_edges`  — cosine similarity edges over embeddings
- `semantic_topic_clusters` — Leiden communities over the semantic graph
- `note_spans`           — markdown AST spans (heading / paragraph / list
                           / code / math / link / quote / callout)
- `concept_mentions`     — lemmatized noun-phrase + entity mentions per
                           span, NFKC-normalized concept_key
- `typed_relations`      — typed inter-note edges (causes / depends_on /
                           contradicts / elaborates / defines /
                           exemplifies / is_a / part_of); source ∈
                           {spacy, llm}; confidence floor enforced
- `note_metrics`         — per-note degree / pagerank / betweenness +
                           role flags (god / bridge / orphan / cut) +
                           community_id + discipline + confidence
- `nexus_insights`       — pre-materialized insight cards
                           (bridge / god / orphan / contradiction /
                           chain / reach / emerging), ranked by score
- `letter_corpus`        — seeded per-discipline reference passages
                           with embedding + license + retrieved_at +
                           corpus_version (auditable)
- `letter_messages`      — per-user chat history with each Letter

All engine outputs keyed by `space_id` so a single-note change
invalidates only local rows. `letter_corpus` is global (read-only,
public-read for authenticated). `letter_messages` are RLS-scoped to the
owning user.

## Tests

```bash
uv run pytest -q                                            # all 35
uv run pytest tests/test_extensive.py -s -q                 # per-space reports
uv run pytest tests/test_production.py -s -q                # full prod reports
uv run pytest tests/test_nexus_extract.py -q                # 9 nexus tests
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

## Letters corpus seed

The Letters tab depends on a seeded reference corpus per discipline.
`src/engine/letters/manifest.json` lists every source URL, license,
and the disciplines it covers (Stanford Encyclopedia of Philosophy,
Internet Encyclopedia of Philosophy, Project Gutenberg, Wikipedia
portals, OpenStax, arXiv, Internet Archive).
`src/engine/letters/seeds/bootstrap.jsonl` ships 25 starter passages
(5 per discipline) with full provenance per row. To embed + load:

```bash
uv run python scripts/seed_letter_corpus.py [--version v1]
```

Idempotent on `(discipline, content_hash, corpus_version)`. Rerun
after adding rows or bumping `corpus_version`.
