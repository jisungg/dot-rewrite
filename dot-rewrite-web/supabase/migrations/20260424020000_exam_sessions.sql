-- Exam sessions: timed, teacher-style exam runs over notes in a space.
-- Question rubrics + student answers + evaluation all live in jsonb so we
-- don't need a separate table per question.

create table if not exists public.exam_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  space_id        uuid not null references public.spaces(id) on delete cascade,
  scope_note_ids  uuid[] not null default '{}',
  questions       jsonb  not null default '[]'::jsonb,
  answers         jsonb  not null default '{}'::jsonb,
  evaluation      jsonb,
  duration_seconds int   not null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text   not null default 'active' check (status in ('active', 'submitted', 'abandoned'))
);

create index if not exists exam_sessions_user_idx
  on public.exam_sessions (user_id, space_id, started_at desc);

alter table public.exam_sessions enable row level security;

drop policy if exists "exam_sessions_owner_all" on public.exam_sessions;
create policy "exam_sessions_owner_all" on public.exam_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.exam_sessions to authenticated;
