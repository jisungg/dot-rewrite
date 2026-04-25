-- Subscriptions + per-user usage counters.
--
-- Tier model: 'free' | 'plus'. Default for every authenticated user is
-- 'free' — a row is auto-inserted on first profile creation so every
-- code path can rely on a row existing.
--
-- Stripe integration is intentionally optional: stripe_* columns stay
-- NULL until billing is wired. A user can be flipped to 'plus' manually
-- (admin / promo) by setting tier='plus' + status='active' +
-- current_period_end.
--
-- Usage counters: rolling per-day buckets per (user, kind). The quota
-- helper increments + checks; we never aggregate from logs.
set search_path = public;

-- ============================================================================
-- subscriptions
-- ============================================================================
create table if not exists public.subscriptions (
    user_id              uuid primary key references auth.users(id) on delete cascade,
    tier                 text not null default 'free' check (tier in ('free', 'plus')),
    status               text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'paused')),
    current_period_end   timestamptz null,
    stripe_customer_id   text null,
    stripe_subscription_id text null,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);
create index if not exists subscriptions_tier_idx on public.subscriptions(tier);

grant select on public.subscriptions to authenticated;
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
    for select to authenticated using (auth.uid() = user_id);
-- writes happen via service role (Stripe webhook / admin).

-- Auto-create a free-tier row on profile insert (mirrors handle_new_user
-- trigger; cheaper than checking-then-inserting in every API route).
create or replace function public.ensure_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id) values (new.user_id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists subscriptions_on_profile_insert on public.profiles;
create trigger subscriptions_on_profile_insert
  after insert on public.profiles
  for each row execute function public.ensure_subscription_row();

-- Backfill existing profiles.
insert into public.subscriptions (user_id)
  select user_id from public.profiles
  on conflict (user_id) do nothing;

-- ============================================================================
-- usage_counters : per (user, kind, day) bucket
-- ============================================================================
create table if not exists public.usage_counters (
    user_id     uuid not null references auth.users(id) on delete cascade,
    kind        text not null,        -- 'dot.chat', 'letters.chat', 'understand', 'exam.start', 'summarize', 'analyze.manual'
    day         date not null,
    count       int  not null default 0,
    updated_at  timestamptz not null default now(),
    primary key (user_id, kind, day)
);
create index if not exists usage_counters_user_kind_idx
    on public.usage_counters(user_id, kind, day desc);

grant select on public.usage_counters to authenticated;
alter table public.usage_counters enable row level security;
drop policy if exists usage_counters_owner_select on public.usage_counters;
create policy usage_counters_owner_select on public.usage_counters
    for select to authenticated using (auth.uid() = user_id);
-- writes happen via service role from the API routes.

-- ============================================================================
-- quota_increment RPC : atomic upsert + return new count
-- ============================================================================
create or replace function public.quota_increment(
    p_user_id uuid,
    p_kind    text,
    p_window  text default 'day'   -- 'day' | 'week'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_day  date;
    v_count int;
begin
    if v_user is null or v_user <> p_user_id then
        raise exception 'quota_increment: not authorized' using errcode = '28000';
    end if;
    v_day := case
        when p_window = 'week' then date_trunc('week', now())::date
        else current_date
    end;
    insert into public.usage_counters (user_id, kind, day, count, updated_at)
        values (p_user_id, p_kind, v_day, 1, now())
        on conflict (user_id, kind, day) do update
            set count = public.usage_counters.count + 1,
                updated_at = now()
        returning count into v_count;
    return v_count;
end;
$$;
revoke all on function public.quota_increment(uuid, text, text) from public;
revoke all on function public.quota_increment(uuid, text, text) from anon;
grant execute on function public.quota_increment(uuid, text, text) to authenticated;
