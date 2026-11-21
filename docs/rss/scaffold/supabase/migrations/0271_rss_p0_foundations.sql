-- 0271_rss_p0_foundations.sql
-- ELOSTATE Remote Sales System - Phase 0: foundations.
--   1. Reporting tree: profiles.manager_id + loop/company guard + rss_can_view_rep()   (F2.4, F3.2)
--   2. Re-score provenance + archive, so a re-score never destroys history            (F15.15, F15.8)
--   3. login_attempts for account lockout                                              (F1.5)
--   4. ai_usage + ai_prices: what each session costs in AI                             (F28.7)
--
-- NUMBERING: 0271 assumes the live repo's last migration is 0270 (0270_transcript_speaker_cluster.sql,
-- seen at commit 0214913). Renumber to the next free number before `npm run db:apply`.
-- Apply ONLY through `npm run db:apply` (ledger: public._agent_migrations). Never by hand.
--
-- This migration does NOT switch existing policies (pitch_scores, coaching tables) to the tree.
-- That is a separate, reviewed step in docs/07 Phase 0, done after admins have set managers,
-- because switching first would hide every rep from every manager.

-- ---------------------------------------------------------------- preflight
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='company_id') then
    raise exception 'RSS preflight: public.profiles.company_id not found - stop and re-read the live schema';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='sales_coach_role') then
    raise exception 'RSS preflight: public.profiles.sales_coach_role not found';
  end if;
  if not exists (select 1 from pg_proc where proname = 'admin_roles') then
    raise exception 'RSS preflight: public.admin_roles() not found (expected from 0265)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='pitch_scores' and column_name='rep_id') then
    raise exception 'RSS preflight: public.pitch_scores.rep_id not found';
  end if;
end $$;

-- ---------------------------------------------------------------- 1. reporting tree
alter table public.profiles add column manager_id uuid references public.profiles(id) on delete set null;
comment on column public.profiles.manager_id is
  'RSS: who this person reports to. Null = top of tree or not yet set. Same company only; no loops (trigger).';
create index profiles_manager_id_idx on public.profiles (manager_id);

create function public.rss_guard_manager() returns trigger language plpgsql as $$
declare
  cur uuid;
  hops int := 0;
begin
  if new.manager_id is null then return new; end if;
  if new.manager_id = new.id then raise exception 'RSS: a person cannot manage themselves'; end if;
  if (select company_id from public.profiles where id = new.manager_id) is distinct from new.company_id then
    raise exception 'RSS: manager must be in the same company';
  end if;
  cur := new.manager_id;
  while cur is not null loop
    if cur = new.id then raise exception 'RSS: that manager would create a reporting loop'; end if;
    hops := hops + 1;
    if hops > 64 then raise exception 'RSS: reporting tree deeper than 64 levels'; end if;
    select manager_id into cur from public.profiles where id = cur;
  end loop;
  return new;
end $$;

create trigger rss_guard_manager before insert or update of manager_id, company_id on public.profiles
  for each row execute function public.rss_guard_manager();

-- Security definer: reads profiles regardless of the caller's profile policies, returns only booleans.
create function public.rss_is_company_admin(uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.role = any (admin_roles()) and p.status <> 'removed')
$$;

create function public.rss_is_manager(uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.status <> 'removed'
                 and (p.sales_coach_role = 'admin' or p.role = any (admin_roles())))
$$;

create function public.rss_is_below(manager uuid, person uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  with recursive up as (
    select p.manager_id as id, 1 as depth from profiles p where p.id = person
    union all
    select p.manager_id, up.depth + 1 from profiles p join up on p.id = up.id
    where up.id is not null and up.depth < 64
  )
  select exists (select 1 from up where up.id = manager)
$$;

-- THE access rule. D2 stand-in: company admins keep company-wide view (today's behaviour).
create function public.rss_can_view_rep(viewer uuid, rep uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select viewer is not null and rep is not null
    and (select company_id from profiles where id = viewer) = (select company_id from profiles where id = rep)
    and (
      viewer = rep
      or rss_is_company_admin(viewer)
      or (rss_is_manager(viewer) and rss_is_below(viewer, rep))
    )
$$;

-- ---------------------------------------------------------------- 2. score provenance + archive
create table public.pitch_score_provenance (
  pitch_score_id uuid primary key references public.pitch_scores(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  model text not null,
  prompt_version text not null,
  rubric_version text not null,
  scored_by_kind text not null check (scored_by_kind in ('auto', 'manager_rescore')),
  scored_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint provenance_manager_named check ((scored_by_kind = 'manager_rescore') = (scored_by is not null))
);
comment on table public.pitch_score_provenance is
  'RSS: model + prompt version behind each score (gap under F15.8). Written by the scorer (service role) only.';

create table public.pitch_score_archive (
  id uuid primary key default gen_random_uuid(),
  -- No FK on purpose: if the live re-score path deletes and re-inserts the score row,
  -- a cascading FK would delete the very history this table exists to keep.
  pitch_score_id uuid not null,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  archived_payload jsonb not null,   -- the replaced score row + its evidence rows, as they were
  archived_by uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) >= 3),
  archived_at timestamptz not null default now()
);
comment on table public.pitch_score_archive is
  'RSS: a re-score copies the old score and evidence here first (D3 stand-in: keep old versions). Append-only.';

alter table public.pitch_score_provenance enable row level security;
alter table public.pitch_score_archive enable row level security;
create policy rss_provenance_select on public.pitch_score_provenance for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id));
create policy rss_archive_select on public.pitch_score_archive for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id));
-- Deliberately NO insert/update/delete policies: only the scoring RPC (service role) writes.

-- ---------------------------------------------------------------- 3. login attempts
create table public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  ip inet,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_email_time_idx on public.login_attempts (email, created_at desc);
alter table public.login_attempts enable row level security;
-- Deliberately NO policies at all: only the server sign-in route (service role) reads or writes.
comment on table public.login_attempts is
  'RSS: one row per sign-in attempt. Lockout policy is D4 (NOT DECIDED); see src/lib/coach/remote/lockout.ts.';

-- ---------------------------------------------------------------- 4. AI cost ledger
create table public.ai_usage (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id),  -- null = ELOSTATE's own background work
  session_id uuid references public.coaching_sessions(id) on delete set null,
  engine text not null,          -- e.g. 'pitch_score', 'summary', 'stt_batch'
  provider text not null,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  audio_seconds numeric not null default 0 check (audio_seconds >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_session_idx on public.ai_usage (session_id);
create index ai_usage_company_day_idx on public.ai_usage (company_id, created_at);

create table public.ai_prices (
  provider text not null,
  model text not null,
  unit text not null check (unit in ('input_token', 'output_token', 'audio_second')),
  usd_per_unit numeric not null check (usd_per_unit >= 0),
  effective_from date not null,
  entered_by uuid not null references public.profiles(id),
  primary key (provider, model, unit, effective_from)
);
comment on table public.ai_prices is
  'RSS: provider prices entered by an ELOSTATE admin. No price is seeded: a missing price shows as missing.';

alter table public.ai_usage enable row level security;
alter table public.ai_prices enable row level security;
-- Deliberately NO tenant policies: AI cost is ELOSTATE's operating data, not the client's.
-- The vendor back office reads it through the service role (requireVendorAdmin, vendorAuth.ts).
