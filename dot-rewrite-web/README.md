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
  app/                    App Router routes, layouts
  components/
    dashboard/            shell + tabs (editor, notes, nexus, dot, settings)
    theme-provider.tsx    owns live .dark class + localStorage
  lib/                    pdf-export, markdown-components, ai-preferences
  utils/supabase/         client/server/middleware, queries helpers
supabase/
  migrations/             timestamped SQL
  functions/process-note/ edge fn, Bearer auth
```

## Key files

- `src/middleware.ts` — session cookie refresh, protected routes
- `src/components/dashboard/home/editor.tsx` — `EditorApi` { dirty, save, discard }
- `src/components/dashboard/home/nexus.tsx` — d3 force graph, consumes engine output
- `src/utils/supabase/queries.ts` — `requireUser`, `saveNoteAndConnectToSpace`, `updateProfilePreferences`

## Data flow with engine

1. User save note → `notes` row in Supabase.
2. Offline: `python analyze_space.py --space-id X` in `dot-rewrite-engine/`.
3. Engine write `note_sim_edges`, `topic_clusters`, `confusion_pairs`,
   `note_diagnostics`, `ranking_explanations`, etc.
4. Web app read those tables for Nexus graph, related notes, weak topics.

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

No test harness yet. Add when flow stabilize.

## Deploy

Vercel. Supabase project provide DB + auth + edge fn.
