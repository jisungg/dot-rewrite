-- .note initial schema
-- tables: profiles, spaces, notes, messages
-- rpc: check_email_exists
-- trigger: auto-insert profile on auth.users insert

set search_path = public;

-- ============================================================================
-- profiles
-- ============================================================================
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  first_name   text not null default '',
  last_name    text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = user_id);

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert with check (auth.uid() = user_id);

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- spaces
-- ============================================================================
create table if not exists public.spaces (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  code         text not null,
  color        text not null,
  color_light  text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists spaces_user_id_idx on public.spaces(user_id);

alter table public.spaces enable row level security;

drop policy if exists "spaces_owner_all" on public.spaces;
create policy "spaces_owner_all" on public.spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- notes
-- ============================================================================
create table if not exists public.notes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  space_id          uuid not null references public.spaces(id) on delete cascade,
  title             text not null default '',
  content           text not null default '',
  tags              text[] not null default '{}',
  pinned            boolean not null default false,
  processed         boolean not null default false,
  archived          boolean not null default false,
  cache             jsonb,
  created_at        timestamptz not null default now(),
  last_modified_at  timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_space_id_idx on public.notes(space_id);
create index if not exists notes_archived_idx on public.notes(archived);

alter table public.notes enable row level security;

drop policy if exists "notes_owner_all" on public.notes;
create policy "notes_owner_all" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep last_modified_at fresh on update
create or replace function public.touch_last_modified()
returns trigger
language plpgsql
as $$
begin
  new.last_modified_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch_last_modified on public.notes;
create trigger notes_touch_last_modified
  before update on public.notes
  for each row execute function public.touch_last_modified();

-- ============================================================================
-- messages (Dot chat history)
-- ============================================================================
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  role       text not null check (role in ('user','dot')),
  content    text not null,
  timestamp  timestamptz not null default now()
);

create index if not exists messages_space_id_idx on public.messages(space_id);
create index if not exists messages_user_id_idx on public.messages(user_id);

alter table public.messages enable row level security;

drop policy if exists "messages_owner_all" on public.messages;
create policy "messages_owner_all" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- rpc: check_email_exists (used by sign-up flow)
-- ============================================================================
create or replace function public.check_email_exists(email_input text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from auth.users where email = email_input);
$$;

grant execute on function public.check_email_exists(text) to anon, authenticated;

-- ============================================================================
-- grants (RLS gates rows; grants gate table access entirely)
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.spaces   to authenticated;
grant select, insert, update, delete on public.notes    to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- Default grants for any future tables (helps if you add more tables later)
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
