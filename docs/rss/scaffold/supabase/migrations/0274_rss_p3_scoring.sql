-- 0274_rss_p3_scoring.sql
-- ELOSTATE Remote Sales System - Phase 3: remote scoring.
--   1. rubric_config.channel: a company may hold one active rubric per channel (F15.9, D6).
--      Existing rows become 'any', so today's single rubric keeps scoring everything.
--   2. keyword_trackers + tracker_hits (F11.1).

-- ---------------------------------------------------------------- preflight
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='rubric_config' and column_name='company_id') then
    raise exception 'RSS preflight: rubric_config.company_id not found - read 0252/0268 and adjust';
  end if;
  if not exists (select 1 from pg_indexes where tablename='rubric_config' and indexdef ilike '%unique%' and indexdef ilike '%(company_id)%') then
    raise exception 'RSS preflight: expected a unique index on rubric_config(company_id) (one active rubric per company, 0252:79)';
  end if;
end $$;

-- ---------------------------------------------------------------- 1. rubric per channel
alter table public.rubric_config add column channel text not null default 'any'
  check (channel in ('any', 'door', 'phone', 'video'));
comment on column public.rubric_config.channel is
  'RSS: which sessions this rubric scores. any = fallback. A remote session scored by a non-remote rubric shows a caveat (rubric.ts).';
do $$
declare iname text;
begin
  for iname in select indexname from pg_indexes where tablename='rubric_config' and indexdef ilike '%unique%' and indexdef ilike '%(company_id)%' loop
    execute format('drop index public.%I', iname);
  end loop;
end $$;
create unique index rubric_config_one_active_per_company_channel on public.rubric_config (company_id, channel) where active;

-- ---------------------------------------------------------------- 2. keyword trackers
create table public.keyword_trackers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) > 0),
  phrases text[] not null check (cardinality(phrases) between 1 and 200),
  side text not null default 'any' check (side in ('rep', 'customer', 'any')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.tracker_hits (
  id bigint generated always as identity primary key,
  tracker_id uuid not null references public.keyword_trackers(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  at_ms integer not null check (at_ms >= 0),
  speaker text not null check (speaker in ('rep', 'customer', 'unknown')),
  matched text not null,
  transcript_version integer not null
);
create index tracker_hits_session_idx on public.tracker_hits (session_id);
create index tracker_hits_tracker_idx on public.tracker_hits (tracker_id);

create function public.rss_company_of(uid uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = uid
$$;

alter table public.keyword_trackers enable row level security;
alter table public.tracker_hits enable row level security;
create policy rss_trackers_select on public.keyword_trackers for select to authenticated
  using (company_id = rss_company_of(auth.uid()));
create policy rss_trackers_insert on public.keyword_trackers for insert to authenticated
  with check (company_id = rss_company_of(auth.uid()) and rss_is_manager(auth.uid()) and created_by = auth.uid());
create policy rss_trackers_update on public.keyword_trackers for update to authenticated
  using (company_id = rss_company_of(auth.uid()) and rss_is_manager(auth.uid()))
  with check (company_id = rss_company_of(auth.uid()));
-- Deliberately NO delete policy: deactivate (active = false) so past hits stay explainable.
create policy rss_hits_select on public.tracker_hits for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id));
-- Deliberately NO write policies on tracker_hits: the pipeline (service role) writes them.
