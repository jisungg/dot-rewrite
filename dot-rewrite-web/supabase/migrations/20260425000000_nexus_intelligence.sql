-- Nexus graph intelligence layer.
--
-- Adds engine-owned tables for: deep markdown-AST spans per note,
-- concept mentions (lemma + entity), typed inter-note relations
-- (spaCy + LLM extracted), per-note centrality + role flags, and
-- pre-materialized insight cards. Then a single nexus_snapshot RPC so
-- the Nexus tab can fetch everything in one round trip.
--
-- All tables are space_id-keyed (matches existing engine pattern). RLS
-- joins back to public.spaces(user_id). Engine writes via service role
-- (bypasses RLS).
set search_path = public;

-- ============================================================================
-- note_spans : markdown AST per note
-- ============================================================================
create table if not exists public.note_spans (
    id              uuid primary key default gen_random_uuid(),
    space_id        uuid not null,
    note_id         uuid not null,
    kind            text not null,        -- heading|paragraph|list_item|code|math|link|quote|callout
    depth           int  not null default 0,
    text            text not null default '',
    char_start      int  not null default 0,
    char_end        int  not null default 0,
    parent_span_id  uuid null,
    created_at      timestamptz not null default now()
);
create index if not exists note_spans_note_idx  on public.note_spans(note_id);
create index if not exists note_spans_space_idx on public.note_spans(space_id);

-- ============================================================================
-- concept_mentions : lemmatized noun-phrase / entity mentions per span
-- ============================================================================
create table if not exists public.concept_mentions (
    id           uuid primary key default gen_random_uuid(),
    space_id     uuid not null,
    note_id      uuid not null,
    span_id      uuid null,
    surface      text not null,
    lemma        text not null,
    concept_key  text not null,           -- normalized: lower(NFKC(lemma))
    pos          text not null default '',
    is_entity    boolean not null default false,
    ent_label    text null
);
create index if not exists concept_mentions_key_idx
    on public.concept_mentions(space_id, concept_key);
create index if not exists concept_mentions_note_idx
    on public.concept_mentions(note_id);

-- ============================================================================
-- typed_relations : note↔note (and concept↔concept) typed edges
-- ============================================================================
create table if not exists public.typed_relations (
    id               uuid primary key default gen_random_uuid(),
    space_id         uuid not null,
    src_note_id      uuid null,
    dst_note_id      uuid null,
    src_concept_key  text null,
    dst_concept_key  text null,
    relation         text not null,       -- causes|depends_on|contradicts|elaborates|defines|exemplifies|is_a|part_of
    evidence         text not null default '',
    source           text not null,       -- 'spacy' | 'llm'
    confidence       real not null default 0,
    created_at       timestamptz not null default now()
);
create index if not exists typed_relations_src_idx
    on public.typed_relations(space_id, src_note_id);
create index if not exists typed_relations_dst_idx
    on public.typed_relations(space_id, dst_note_id);
create index if not exists typed_relations_kind_idx
    on public.typed_relations(space_id, relation);

-- ============================================================================
-- note_metrics : per-note centrality + role flags
-- ============================================================================
create table if not exists public.note_metrics (
    space_id       uuid not null,
    note_id        uuid not null,
    degree         int  not null default 0,
    pagerank       real not null default 0,
    betweenness    real not null default 0,
    is_god_node    boolean not null default false,
    is_bridge      boolean not null default false,
    is_orphan      boolean not null default false,
    is_cut_vertex  boolean not null default false,
    community_id   text null,
    computed_at    timestamptz not null default now(),
    primary key (space_id, note_id)
);
create index if not exists note_metrics_space_idx on public.note_metrics(space_id);
create index if not exists note_metrics_god_idx
    on public.note_metrics(space_id, is_god_node) where is_god_node;
create index if not exists note_metrics_bridge_idx
    on public.note_metrics(space_id, is_bridge) where is_bridge;
create index if not exists note_metrics_orphan_idx
    on public.note_metrics(space_id, is_orphan) where is_orphan;

-- ============================================================================
-- nexus_insights : pre-materialized insight cards
-- ============================================================================
create table if not exists public.nexus_insights (
    id           uuid primary key default gen_random_uuid(),
    space_id     uuid not null,
    kind         text not null,           -- bridge|god|orphan|contradiction|chain|reach|emerging
    payload      jsonb not null default '{}'::jsonb,
    score        real not null default 0,
    computed_at  timestamptz not null default now()
);
create index if not exists nexus_insights_kind_idx
    on public.nexus_insights(space_id, kind, score desc);

-- ============================================================================
-- RLS : grant select to authenticated; ownership via spaces.user_id
-- Engine writes use service role and bypass RLS by design.
-- ============================================================================
do $$
declare
    tbl text;
begin
    foreach tbl in array array[
        'note_spans',
        'concept_mentions',
        'typed_relations',
        'note_metrics',
        'nexus_insights'
    ]
    loop
        execute format('grant select on public.%I to authenticated', tbl);
        execute format('alter table public.%I enable row level security', tbl);
        execute format('drop policy if exists %I_owner_select on public.%I', tbl, tbl);
        execute format(
            'create policy %I_owner_select on public.%I for select to authenticated '
            'using (exists (select 1 from public.spaces s '
            '               where s.id = public.%I.space_id '
            '                 and s.user_id = auth.uid()))',
            tbl, tbl, tbl
        );
    end loop;
end $$;

-- ============================================================================
-- nexus_snapshot RPC : single-call fetch for the Nexus tab.
-- Definer-mode + explicit per-space ownership guard.
-- Returns ONLY rows belonging to spaces the calling user owns.
-- ============================================================================
create or replace function public.nexus_snapshot(p_space_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_owned uuid[];
    v_result jsonb;
begin
    if v_user is null then
        raise exception 'nexus_snapshot: not authenticated' using errcode = '28000';
    end if;
    if p_space_ids is null or array_length(p_space_ids, 1) is null then
        return jsonb_build_object(
            'notes', '[]'::jsonb, 'semantic_edges', '[]'::jsonb,
            'prereq_edges', '[]'::jsonb, 'confusion_pairs', '[]'::jsonb,
            'semantic_clusters', '[]'::jsonb, 'note_metrics', '[]'::jsonb,
            'insights_top', '[]'::jsonb, 'computed_at', now()
        );
    end if;

    select coalesce(array_agg(s.id), array[]::uuid[])
      into v_owned
      from public.spaces s
     where s.id = any(p_space_ids)
       and s.user_id = v_user;

    if array_length(v_owned, 1) is null then
        return jsonb_build_object(
            'notes', '[]'::jsonb, 'semantic_edges', '[]'::jsonb,
            'prereq_edges', '[]'::jsonb, 'confusion_pairs', '[]'::jsonb,
            'semantic_clusters', '[]'::jsonb, 'note_metrics', '[]'::jsonb,
            'insights_top', '[]'::jsonb, 'computed_at', now()
        );
    end if;

    select jsonb_build_object(
        'notes', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', n.id, 'space_id', n.space_id,
                'title', n.title, 'tags', n.tags
            ))
              from public.notes n
             where n.space_id = any(v_owned)
               and coalesce(n.archived, false) = false
        ), '[]'::jsonb),
        'semantic_edges', coalesce((
            select jsonb_agg(jsonb_build_object(
                'space_id', e.space_id,
                'src_note_id', e.src_note_id,
                'dst_note_id', e.dst_note_id,
                'similarity', e.similarity,
                'mutual', e.mutual
            ))
              from public.note_semantic_edges e
             where e.space_id = any(v_owned)
        ), '[]'::jsonb),
        'prereq_edges', coalesce((
            select jsonb_agg(jsonb_build_object(
                'space_id', e.space_id,
                'src_node_id', e.src_node_id,
                'dst_node_id', e.dst_node_id,
                'kind', e.kind,
                'weight', e.weight
            ))
              from public.study_state_edges e
             where e.space_id = any(v_owned)
               and e.kind = 'prerequisite'
        ), '[]'::jsonb),
        'confusion_pairs', coalesce((
            select jsonb_agg(jsonb_build_object(
                'space_id', p.space_id,
                'topic_a', p.topic_a,
                'topic_b', p.topic_b,
                'score', p.score
            ))
              from public.confusion_pairs p
             where p.space_id = any(v_owned)
        ), '[]'::jsonb),
        'semantic_clusters', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', c.id,
                'space_id', c.space_id,
                'stable_id', c.stable_id,
                'label', c.label,
                'keywords', c.keywords,
                'note_ids', c.note_ids,
                'parent_topic', c.parent_topic,
                'hierarchy_path', c.hierarchy_path
            ))
              from public.semantic_topic_clusters c
             where c.space_id = any(v_owned)
        ), '[]'::jsonb),
        'note_metrics', coalesce((
            select jsonb_agg(jsonb_build_object(
                'space_id', m.space_id,
                'note_id', m.note_id,
                'degree', m.degree,
                'pagerank', m.pagerank,
                'betweenness', m.betweenness,
                'is_god_node', m.is_god_node,
                'is_bridge', m.is_bridge,
                'is_orphan', m.is_orphan,
                'is_cut_vertex', m.is_cut_vertex,
                'community_id', m.community_id
            ))
              from public.note_metrics m
             where m.space_id = any(v_owned)
        ), '[]'::jsonb),
        'insights_top', coalesce((
            select jsonb_agg(row_to_jsonb(t))
              from (
                select i.id, i.space_id, i.kind, i.payload, i.score, i.computed_at
                  from public.nexus_insights i
                 where i.space_id = any(v_owned)
                 order by i.score desc
                 limit 30
              ) t
        ), '[]'::jsonb),
        'computed_at', now()
    ) into v_result;

    return v_result;
end;
$$;

revoke all on function public.nexus_snapshot(uuid[]) from public;
revoke all on function public.nexus_snapshot(uuid[]) from anon;
grant execute on function public.nexus_snapshot(uuid[]) to authenticated;

-- ============================================================================
-- nexus_typed_relations RPC : on-demand fetch for typed relations.
-- ============================================================================
create or replace function public.nexus_typed_relations(
    p_space_ids uuid[],
    p_relation  text default null
)
returns setof public.typed_relations
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_owned uuid[];
begin
    if v_user is null then
        raise exception 'nexus_typed_relations: not authenticated' using errcode = '28000';
    end if;
    if p_space_ids is null or array_length(p_space_ids, 1) is null then
        return;
    end if;
    select coalesce(array_agg(s.id), array[]::uuid[])
      into v_owned
      from public.spaces s
     where s.id = any(p_space_ids)
       and s.user_id = v_user;
    if array_length(v_owned, 1) is null then
        return;
    end if;
    return query
        select tr.*
          from public.typed_relations tr
         where tr.space_id = any(v_owned)
           and (p_relation is null or tr.relation = p_relation);
end;
$$;
revoke all on function public.nexus_typed_relations(uuid[], text) from public;
revoke all on function public.nexus_typed_relations(uuid[], text) from anon;
grant execute on function public.nexus_typed_relations(uuid[], text) to authenticated;

-- ============================================================================
-- nexus_concept_reach RPC : where does a concept appear?
-- ============================================================================
create or replace function public.nexus_concept_reach(
    p_space_ids  uuid[],
    p_concept_key text
)
returns setof public.concept_mentions
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_owned uuid[];
begin
    if v_user is null then
        raise exception 'nexus_concept_reach: not authenticated' using errcode = '28000';
    end if;
    if p_space_ids is null or array_length(p_space_ids, 1) is null
       or p_concept_key is null or length(p_concept_key) = 0 then
        return;
    end if;
    select coalesce(array_agg(s.id), array[]::uuid[])
      into v_owned
      from public.spaces s
     where s.id = any(p_space_ids)
       and s.user_id = v_user;
    if array_length(v_owned, 1) is null then
        return;
    end if;
    return query
        select cm.*
          from public.concept_mentions cm
         where cm.space_id = any(v_owned)
           and cm.concept_key = p_concept_key;
end;
$$;
revoke all on function public.nexus_concept_reach(uuid[], text) from public;
revoke all on function public.nexus_concept_reach(uuid[], text) from anon;
grant execute on function public.nexus_concept_reach(uuid[], text) to authenticated;

-- ============================================================================
-- nexus_insight_detail RPC : full payload for an insight by id (ownership-checked)
-- ============================================================================
create or replace function public.nexus_insight_detail(
    p_insight_id uuid
)
returns public.nexus_insights
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_row  public.nexus_insights;
begin
    if v_user is null then
        raise exception 'nexus_insight_detail: not authenticated' using errcode = '28000';
    end if;
    select i.*
      into v_row
      from public.nexus_insights i
      join public.spaces s on s.id = i.space_id
     where i.id = p_insight_id
       and s.user_id = v_user;
    if not found then
        raise exception 'nexus_insight_detail: not found' using errcode = '42704';
    end if;
    return v_row;
end;
$$;
revoke all on function public.nexus_insight_detail(uuid) from public;
revoke all on function public.nexus_insight_detail(uuid) from anon;
grant execute on function public.nexus_insight_detail(uuid) to authenticated;
