-- Letters: five expert per-discipline agents (M, S, C, P, H).
--
-- Adds:
--   * letter_corpus      — curated, auditable passages per discipline
--                          (seeded from manifest, embedded by engine)
--   * letter_messages    — per-user chat history per Letter
--   * note_metrics.discipline + discipline_confidence
--   * spaces.declared_discipline (user-declared fallback)
--
-- Discipline values: 'M' | 'S' | 'C' | 'P' | 'H' | NULL.
--
set search_path = public;

-- ============================================================================
-- letter_corpus : curated public passages per discipline
-- ============================================================================
create table if not exists public.letter_corpus (
    id              uuid primary key default gen_random_uuid(),
    discipline      text not null check (discipline in ('M', 'S', 'C', 'P', 'H')),
    source_kind     text not null default 'seed',  -- 'seed' | 'user' (future)
    source_url      text not null,
    license         text not null default '',
    title           text not null default '',
    section         text not null default '',
    content         text not null,
    content_hash    text not null,
    vector          real[] not null default '{}',
    dim             int  not null default 0,
    model           text not null default '',
    retrieved_at    timestamptz not null default now(),
    corpus_version  text not null default 'v1',
    unique (discipline, content_hash, corpus_version)
);
create index if not exists letter_corpus_discipline_idx
    on public.letter_corpus(discipline);
create index if not exists letter_corpus_version_idx
    on public.letter_corpus(corpus_version, discipline);

-- Public read for any signed-in user — corpus is non-secret reference data.
grant select on public.letter_corpus to authenticated;
alter table public.letter_corpus enable row level security;
drop policy if exists letter_corpus_authenticated_read on public.letter_corpus;
create policy letter_corpus_authenticated_read on public.letter_corpus
    for select to authenticated using (true);

-- ============================================================================
-- letter_messages : per-user chat history scoped to a single Letter.
-- ============================================================================
create table if not exists public.letter_messages (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    discipline      text not null check (discipline in ('M', 'S', 'C', 'P', 'H')),
    role            text not null check (role in ('user', 'letter')),
    content         text not null,
    citations       jsonb not null default '[]'::jsonb,
    -- model_segments: array of {start, end} char offsets into content where
    -- the response was NOT grounded in retrieved corpus (model knowledge).
    model_segments  jsonb not null default '[]'::jsonb,
    space_id        uuid null,
    created_at      timestamptz not null default now()
);
create index if not exists letter_messages_user_idx
    on public.letter_messages(user_id, discipline, created_at desc);

grant select, insert, delete on public.letter_messages to authenticated;
alter table public.letter_messages enable row level security;
drop policy if exists letter_messages_owner_select on public.letter_messages;
create policy letter_messages_owner_select on public.letter_messages
    for select to authenticated using (auth.uid() = user_id);
drop policy if exists letter_messages_owner_insert on public.letter_messages;
create policy letter_messages_owner_insert on public.letter_messages
    for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists letter_messages_owner_delete on public.letter_messages;
create policy letter_messages_owner_delete on public.letter_messages
    for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- note_metrics: add per-note discipline classification (engine-computed).
-- ============================================================================
alter table public.note_metrics
    add column if not exists discipline             text
        check (discipline in ('M', 'S', 'C', 'P', 'H') or discipline is null),
    add column if not exists discipline_confidence  real not null default 0;
create index if not exists note_metrics_discipline_idx
    on public.note_metrics(space_id, discipline)
    where discipline is not null;

-- ============================================================================
-- spaces: user-declared discipline (fallback when engine hasn't classified).
-- ============================================================================
alter table public.spaces
    add column if not exists declared_discipline text
        check (declared_discipline in ('M', 'S', 'C', 'P', 'H') or declared_discipline is null);
