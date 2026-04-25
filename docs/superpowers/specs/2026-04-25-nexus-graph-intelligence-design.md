# Nexus Graph Intelligence — Design

**Date:** 2026-04-25
**Author:** jisungg + Claude
**Status:** Approved for implementation

## Goal

Surface the engine's Leiden community structure, god-nodes, and a new layer of typed relations into the Nexus tab so the graph becomes a queryable, living map of the user's thinking. Replace the d3 renderer with WebGL (`react-force-graph-2d`) to ship the new visual surface and unlock perf headroom. Add an Insights panel that answers questions only a graph can answer.

## Non-goals

- Real-time on-save extraction (engine remains the batch source of truth).
- Replacing semantic clusters / topics / prereqs / confusion (these stay; we extend them).
- Multi-user collaboration / shared graphs.
- Interactive graph editing (read-only surface; user edits notes, engine recomputes).

## Architecture

```
note edit ─→ web ─→ Supabase
                       │
                       ▼
          analyze_space.py (extended)
            ├── existing: leiden, topics, semantic edges, prereqs, confusion
            ├── NEW markdown_ast       → note_spans
            ├── NEW concept_extract    → concept_mentions
            ├── NEW relation_spacy     → typed_relations(source='spacy')
            ├── NEW centrality         → note_metrics (god/bridge/orphan/cut)
            ├── NEW relation_llm       → typed_relations(source='llm')   [god ∪ bridge only]
            └── NEW insights           → nexus_insights (top-25 per kind)
                       │
                       ▼
               nexus_snapshot RPC (definer, RLS-guarded)
                       │
                       ▼
         web: react-force-graph-2d renderer
            + Insights panel (lazy detail fetch)
            + Skeleton loaders
```

## Data model

New tables (migration `20260425000000_nexus_intelligence.sql`):

| Table | Purpose |
|---|---|
| `note_spans` | Markdown-AST spans per note (heading, paragraph, list_item, code, math, link, quote, callout) with depth + char ranges |
| `concept_mentions` | Lemmatized noun phrases + entities per span; `concept_key = lower(NFKC(lemma))` |
| `typed_relations` | Note→note (or concept→concept) typed edges: `causes`, `depends_on`, `contradicts`, `elaborates`, `defines`, `exemplifies`, `is_a`, `part_of`. Source ∈ {`spacy`, `llm`}. Confidence ≥ 0.5 (spaCy) / 0.6 (LLM). |
| `note_metrics` | Per-note `degree`, `pagerank`, `betweenness`, `is_god_node`, `is_bridge`, `is_orphan`, `is_cut_vertex`, `community_id` |
| `nexus_insights` | Pre-materialized cards: `kind` ∈ {bridge, god, orphan, contradiction, chain, reach, emerging}, `payload` jsonb, `score` float |

All tables RLS-scoped by `user_id`. Mirrored in `engine/store/schema.sql`.

## Engine pipeline (extended)

Stages added to `engine/pipeline/runner.py`, each idempotent by note content hash:

1. `markdown_ast` — `mistune` parse → spans
2. `concept_extract` — `spaCy en_core_web_sm` over span text → mentions (lemma + entity)
3. `relation_spacy` — dep-pattern matcher on spans → typed relations (source=`spacy`)
4. `centrality` — `igraph` PageRank, betweenness, articulation points → metrics + roles
5. `relation_llm` — for `is_god_node ∨ is_bridge`, prompt LLM (`prompt-injection guard`: content delimited, system instructs ignore-inside) → typed relations (source=`llm`)
6. `insights` — derive 7 kinds; rank by `score = w₁·centrality + w₂·recency + w₃·confidence`; keep top 25/kind

All stages obey existing budget/fail-soft framework (`engine/budget.py`, `engine/safeguards.py`).

## Postgres RPC

```sql
nexus_snapshot(p_user_id uuid) returns jsonb
  -- security definer; first line: assert auth.uid() = p_user_id
  -- returns notes (no content), edges (semantic + prereq + confusion),
  -- semantic_clusters, note_metrics, top-30 insights, computed_at
nexus_typed_relations(p_user_id uuid, p_relation text default null) returns setof typed_relations
nexus_concept_reach(p_user_id uuid, p_concept_key text) returns setof concept_mentions
nexus_insight_detail(p_user_id uuid, p_insight_id uuid) returns jsonb
```

`grant execute … to authenticated; revoke … from anon;`

## Web

### Files

```
src/components/dashboard/home/
  nexus.tsx                  shell, layout, fetch orchestration
  nexus-graph.tsx            react-force-graph-2d renderer + custom painters
  nexus-insights-panel.tsx   right panel, 7 sections, focus-on-click
  nexus-controls.tsx         toolbar (space dropdown, search, zoom, layer toggles)

src/lib/
  use-nexus-snapshot.ts      RPC hook; revalidated by useEngineUpdates; 60s staleTime
  use-nexus-lazy.ts          on-demand typed_relations / concept_reach / insight_detail
```

### Renderer

`react-force-graph-2d` (canvas/WebGL). Custom painters:

- **god-node**: r=10 + halo ring + permanent label
- **orphan**: dim 40% + dashed outline
- **bridge**: square marker
- **community hulls**: convex hull behind nodes, labeled with cluster name
- **typed edges**: distinct hues per relation type; hover shows relation + evidence quote
- existing semantic / prereq / confusion edge styles preserved

Layer toggles: Similarity · Dependencies · Confusion · Typed Relations · Community Hulls · God Halos.

### Insights panel

Card sections (each click → focus graph + lazy detail fetch):

1. **Bridges** — only-path notes between communities
2. **God-nodes** — anchor notes
3. **Dependency chains** — topo order from `depends_on` typed relations
4. **Contradictions** — `contradicts` typed relations
5. **Concept reach** — concepts spanning ≥3 communities
6. **Emerging** — new clusters since last run
7. **Orphans** — disconnected notes list

### Loading

- shadcn `Skeleton` over graph + panel during initial RPC.
- Inline `Loader2` on layer toggles during lazy fetch; per-session cache.
- Snapshot payload omits note content (titles only); content fetched on hover/click.

## Security

- RLS on all new tables, scoped to `auth.uid() = user_id`.
- All RPCs `security definer` with explicit `auth.uid() = p_user_id` guard at top.
- `revoke … from anon`, `grant … to authenticated`.
- LLM extraction: content wrapped in `<<<NOTE>>> … <<<END>>>` delimiters; system prompt instructs to ignore any instructions inside.
- All engine writes parameterized (`psycopg3` placeholders); no f-string SQL.
- Concept keys NFKC-normalized to prevent homoglyph dedup escape.
- Confidence floor enforced at write time.

## Tests

### Engine (pytest)

- `markdown_ast`: each block kind round-trips with correct depth + char ranges
- `concept_extract`: lemma dedupe, NFKC normalization, entity tagging
- `relation_spacy`: each dep pattern fires on positive fixture, doesn't fire on negative
- `centrality`: known-graph fixtures (line, star, two-clique) yield expected god/bridge/orphan flags
- `insights`: top-K ranking honors recency decay; payload schemas validate

### DB

- migration up + down clean
- RLS test: user A select on user B rows returns 0
- RPC perms: anon execute denied; authenticated cross-user denied

### Web

- `bun run typecheck` (`tsc --noEmit`, strict)
- `bun run lint`
- vitest: hook contracts (success, error, empty, RPC timeout); insight-card click handler dispatch; layer toggle state machine
- Manual smoke: cold load skeleton; god-halo render; insight click focuses graph; orphan list; 1k-node frame rate

### Edge cases

zero notes · single note · all-orphans · single huge community · concept in only 1 community · LLM returns empty · RPC timeout (toast + retry) · RLS denial (clean toast) · save during snapshot fetch (race resolved by `useEngineUpdates` revalidation) · dark mode contrast on hulls + halos · narrow viewport (panel collapsible)

## Migration plan

1. Ship migration + engine code + new tables empty.
2. Run engine analyze on a test space → verify writes.
3. Ship web RPC + types + hooks (graph still uses d3).
4. Ship renderer swap behind a flag (none initially — direct cutover; old component deleted in same PR).
5. Run engine on user spaces; user verifies surface.

## Out-of-scope follow-ups

- Cut-vertex highlight / "fragility" insight kind (#4 from question set)
- Stale-cluster insight (#8)
- Knowledge-gap insight (#10)
- Cosmograph migration if scale exceeds 10k nodes/user
- Real-time incremental extraction on save
