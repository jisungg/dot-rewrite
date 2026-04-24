# dot-rewrite

Study notes app. Write notes. Engine read notes. Engine find structure.
Two parts in one monorepo.

```
dot-rewrite/
├── dot-rewrite-web/      Next.js app. UI + auth + note CRUD + Supabase client.
└── dot-rewrite-engine/   Python 3.12 analysis engine. One script, no service.
```

## Parts

### dot-rewrite-web
User-facing app. Note editor, space browser, review surfaces. Bun runtime.
Supabase Postgres for data. All note writes land here.
See `dot-rewrite-web/README.md`.

### dot-rewrite-engine
Offline analysis. Read notes from Supabase. Build hybrid similarity graph.
Detect topics. Score coverage, fragmentation, confusion pairs, prereq gaps.
Write results back. No embeddings, no service, no queue. Pure algorithmic.
See `dot-rewrite-engine/README.md`.

## How data flow

```
user edit note → web app → Supabase Postgres
                                  ↓
                     python analyze_space.py --space-id X
                                  ↓
                     back into Supabase (topics, edges, diagnostics)
                                  ↓
                            web app read, render
```

## Run

```bash
# web
cd dot-rewrite-web && bun dev

# engine (separate terminal)
cd dot-rewrite-engine
uv sync
cp .env.example .env          # fill SUPABASE_DB_URL
psql "$SUPABASE_DB_URL" -f src/engine/store/schema.sql
uv run python analyze_space.py --space-id <uuid>
```

## Tech

- web: Next.js, TypeScript, Bun, Supabase, shadcn/ui
- engine: Python 3.12, uv, psycopg3, scikit-learn, igraph + leidenalg, gensim, nltk

## Note on git

`dot-rewrite-web/` holds its own `.git/` from earlier solo repo. Parent
monorepo is new. Decide: keep web as submodule, or flatten (rm web/.git,
treat monorepo as single history). `.gitignore` in root already skip most
junk; check `dot-rewrite-web/.git/` choice before first commit.
