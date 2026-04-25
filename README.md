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
User-facing app. Note editor, space browser, review surfaces, expert
agents. Bun runtime. Supabase Postgres for data. All note writes land
here.
See `dot-rewrite-web/README.md`.

### dot-rewrite-engine
Offline analysis. Read notes from Supabase. Build hybrid + semantic
similarity graph. Detect topics. Score coverage, fragmentation,
confusion pairs, prereq gaps. Extract markdown spans, concepts, typed
relations, centrality + role flags, insight cards. Classify notes by
academic discipline. Write everything back. No service, no queue.
See `dot-rewrite-engine/README.md`.

## How data flow

```
user edit note → web app → Supabase Postgres
                                  ↓
                     python analyze_space.py --space-id X
                                  ↓
                     back into Supabase
                       (topics, edges, diagnostics,
                        nexus intelligence, discipline tags)
                                  ↓
                            web app read, render
```

## Surfaces (web)

- **Editor** — markdown + math + code, server-merged save path
- **Notes** — list + filter + bulk process
- **Nexus** — WebGL force graph (react-force-graph-2d) showing all
  notes, semantic edges, prereq + confusion edges, typed relations,
  community hulls, god-node halos, orphan + bridge markers; right-side
  Insights panel surfaces bridges, anchors, dependency chains,
  contradictions, concept reach, emerging clusters, orphans
- **Letters** — five expert per-discipline agents (M / S / C / P / H),
  each grounded in a curated, auditable public corpus (SEP, Wikipedia
  portals, OpenStax, Project Gutenberg, arXiv, Internet Archive).
  Strictly in-discipline; off-topic redirects to the right Letter.
  Inline `[n]` citations with hover-cards showing source URL + license
  + retrieval date.
- **Per-space**: Dot chat, Outline, TL;DR, Relationships (deep
  intelligence per space), Understand, Exam.

## First-run setup

```bash
# 1. Web
cd dot-rewrite-web
bun install
cp .env.example .env.local        # fill Supabase URL + anon key + service role
bun dev                           # http://localhost:3000

# 2. Apply DB migrations (idempotent, in order)
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260423000000_init.sql
# ... all subsequent migrations through ...
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260425010000_letters.sql

# 3. Engine
cd ../dot-rewrite-engine
uv sync --extra dev
cp .env.example .env              # fill SUPABASE_DB_URL
psql "$SUPABASE_DB_URL" -f src/engine/store/schema.sql
uv run python -m spacy download en_core_web_sm  # required for Nexus + Letters
uv run python scripts/seed_letter_corpus.py     # seed Letters corpus

# 4. Per-space analysis (run for each space the user creates)
uv run python analyze_space.py --space-id <uuid>
```

## Tech

- **web**: Next.js 16, TypeScript (strict), Bun, Supabase, Tailwind v4,
  shadcn/ui, react-force-graph-2d, react-markdown + remark-gfm +
  remark-math + rehype-katex + rehype-prism + rehype-sanitize
- **engine**: Python 3.12, uv, psycopg3, scikit-learn, igraph + leidenalg,
  gensim, nltk, spaCy, sentence-transformers, mistune, Anthropic SDK
  (optional)

## Verification

```bash
# web
cd dot-rewrite-web
bunx tsc --noEmit          # strict typecheck
bunx next build --turbo    # production build

# engine
cd dot-rewrite-engine
uv run pytest -q           # 35 tests across smoke + extensive + production + nexus extract
```

## Note on git

`dot-rewrite-web/` historically held its own `.git/` from an earlier
solo repo. Parent monorepo is now the single source of truth.
`.gitignore` in root skips most junk; check before first commit.
