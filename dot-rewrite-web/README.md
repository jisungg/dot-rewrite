# dot-rewrite-web

Next.js 16 app. Write notes. Browse spaces. Review output from engine.
Sibling of `dot-rewrite-engine/` in monorepo root.

## Stack

- Next 16.2.4 + Turbopack + React 19 (Compiler on). App Router only.
- Bun runtime. Lockfile `bun.lock`. No npm/yarn/pnpm.
- Tailwind v4. Class-based dark mode via `@custom-variant dark`.
- Supabase SSR auth + Postgres. RLS scoped by `user_id`.
- Edge fn `supabase/functions/process-note`.

## Run

```bash
bun install
bun dev        # http://localhost:3000
```

Env: `.env.local` with Supabase URL + anon key + service role (for edge fn).

## Layout

```
src/
  app/
    api/
      dot/chat            per-space chat (Dot)
      letters/chat        per-discipline chat (Letters), discipline-gated
      analyze-space       trigger engine
      summarize-*         note + space summaries
      understand/*        questions + evaluation
      exam/*              start / active / submit
    dashboard/page.tsx    shell, tabs, dirty-nav guard
  components/
    dashboard/
      home/
        editor.tsx        EditorApi { dirty, save, discard }
        notes.tsx         list + filter
        nexus.tsx         WebGL force graph + Insights panel + controls
        nexus-graph.tsx   react-force-graph-2d renderer
        nexus-insights-panel.tsx
        letters.tsx       5-letter picker + chat surface
      class/
        dot.tsx           per-space chat
        space-relationships.tsx  per-space deep-intelligence view
        ...
    theme-provider.tsx    owns live .dark class + localStorage
  lib/
    use-nexus-snapshot.ts hook for nexus_snapshot RPC + lazy fetchers
    letters/retrieve.ts   server util: corpus fetch + lexical retrieval
                          + question classifier (for redirects)
    engine-events.ts      cross-component bus for engine completion
    markdown-components.tsx, pdf-export, ai-preferences, ...
  utils/supabase/         client/server/middleware, queries helpers
supabase/
  migrations/             timestamped SQL (init + nexus + letters + ...)
  functions/process-note/ edge fn, Bearer auth
```

## Key files

- `src/middleware.ts` — session cookie refresh, protected routes
- `src/components/dashboard/home/editor.tsx` — `EditorApi` { dirty, save, discard }
- `src/components/dashboard/home/nexus.tsx` — Nexus shell; uses
  `useNexusSnapshot` (single nexus_snapshot RPC + lazy hooks for typed
  relations / concept reach / insight detail)
- `src/components/dashboard/home/letters.tsx` — Letters tab; per-Letter
  history, streamed responses with inline `[n]` citations + bottom
  source list
- `src/app/api/letters/chat/route.ts` — discipline-strict RAG, fast
  redirect on off-topic, README-style concise system prompt
- `src/utils/supabase/queries.ts` — `requireUser`,
  `saveNoteAndConnectToSpace`, `updateProfilePreferences`,
  `fetchNexusSnapshot` (with table-fallback when RPC missing),
  `fetchTypedRelations`, `fetchConceptReach`, `fetchInsightDetail`

## Data flow with engine

1. User save note → `notes` row in Supabase.
2. Offline: `python analyze_space.py --space-id X` in `dot-rewrite-engine/`.
3. Engine writes:
   - Algorithmic: `note_sim_edges`, `topic_clusters`, `confusion_pairs`,
     `note_diagnostics`, `ranking_explanations`
   - Semantic: `note_embeddings`, `note_semantic_edges`,
     `semantic_topic_clusters`
   - Nexus intelligence: `note_spans`, `concept_mentions`,
     `typed_relations`, `note_metrics` (god / bridge / orphan / cut /
     discipline), `nexus_insights`
4. Web reads via:
   - **Nexus tab** — single `nexus_snapshot(p_space_ids[])` RPC
     (security-definer, RLS-guarded by spaces.user_id) + lazy
     `nexus_typed_relations`, `nexus_concept_reach`,
     `nexus_insight_detail` RPCs
   - **Per-space Relationships tab** — same snapshot scoped to one space
   - **Letters tab** — independent of engine: reads `letter_corpus`
     (seeded once via `scripts/seed_letter_corpus.py` in the engine);
     falls back to space-declared discipline if engine has not run.

## Auth

Supabase SSR, cookie session. `requireUser` gate in queries.
Middleware redirect `(auth)` layout to `/dashboard` when signed in.

## Agent rules

See `AGENTS.md`. Short version:
- Next 16 breaking changes — read `node_modules/next/dist/docs/` before code.
- Bun only.
- Pair every light Tailwind token with dark counterpart.
- User preferences persisted server-side in `profiles.preferences` jsonb.
- Toasts via `sonner`. Every mutation + query wrapped.
- Dirty guard: editor + settings pending-nav pattern.

## Progress

See `FEATURES.md`.

## Tests

```bash
bunx tsc --noEmit          # strict typecheck (passes clean)
bunx next build --turbo    # production build (passes clean)
```

Vitest + Playwright not wired yet. Cross-cutting verification done via
the engine pytest suite (35 tests) plus manual smoke through the
dashboard.

## Migrations to apply

In order, all idempotent:

```
20260423000000_init.sql
20260423010000_add_profile_preferences.sql
20260424000000_touch_skip_processed.sql
20260424010000_spaces_summary_cache.sql
20260424020000_exam_sessions.sql
20260424030000_realtime_publication.sql
20260425000000_nexus_intelligence.sql      # snapshot RPC + nexus tables
20260425010000_letters.sql                 # letter_corpus + letter_messages
                                           # + note_metrics.discipline
                                           # + spaces.declared_discipline
```

After applying letters migration, run the engine seed script once:

```bash
cd ../dot-rewrite-engine
uv run python scripts/seed_letter_corpus.py
```

## Deploy

Vercel. Supabase project provide DB + auth + edge fn. The engine runs
out-of-band (cron / CI / local) against the same Supabase URL via
`SUPABASE_DB_URL`.
