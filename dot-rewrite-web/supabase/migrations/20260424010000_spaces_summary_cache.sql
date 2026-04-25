-- Per-space TL;DR cache. Populated by /api/summarize-space.
-- Shape: { summary: string, content_hash: string, updated_at: string }

alter table public.spaces
  add column if not exists summary_cache jsonb;
