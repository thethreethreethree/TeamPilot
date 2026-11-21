-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0272 — RSS Phase 0: foundations (ELOSTATE Remote Sales System build plan, docs/rss/)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Source: docs/rss/scaffold/supabase/migrations/0271_rss_p0_foundations.sql, renumbered (0271 is
-- 0271_system_storage_usage.sql) and adapted to this repo's rules. Build record: docs/tbc/2026-11-15-rss-p0.
--
--   1. Reporting tree: profiles.manager_id + loop/company guard + rss_can_view_rep()   (F2.4, F3.2)
--   2. Re-score provenance + archive, so a re-score never destroys history            (F15.15, F15.8)
--   3. login_attempts for account lockout (lockout numbers are D4, NOT DECIDED)        (F1.5)
--   4. ai_usage + ai_prices: what each session costs in AI                             (F28.7)
--
-- Decisions applied (founder pickers 2026-11-15): D2 company admins keep company-wide view; D3 a re-score
-- archives first and flags earlier overrides (that is route code, not this file).
--
-- THIS MIGRATION DOES NOT SWITCH EXISTING POLICIES to the tree (pitch_scores 0252:239, coaching 0084:40,
-- recording_comments 0259). That is Phase 0 step 8, per company, after admins have set managers; switching
-- first would hide every rep from every manager.
--
-- WHERE THIS DIFFERS FROM THE SCAFFOLD, AND WHY
--   · Re-runnable (A12; migration:audit applies every migration twice): if-not-exists / or-replace /
--     drop-if-exists throughout. The scaffold used bare create/alter.
--   · The rss_* helpers are SECURITY DEFINER and take USER ids. PostgREST exposes every public function as
--     an RPC, so any signed-in user could ask "is X below Y?" or "is X an admin?" about anyone (the
--     INVARIANT 4 class, with user ids instead of company ids). So: the helpers are revoked from clients,
--     and rss_can_view_rep() answers only for the caller (viewer must be auth.uid(); the service role,
--     whose auth.uid() is null, may ask about anyone). RLS policies always pass auth.uid(), so they work.
--   · rss_is_manager follows admin_roles() (0265) + sales_coach_role, which is the TypeScript authority
--     isSalesCoachManager. The older SQL is_sales_coach_manager() (0252) hard-codes CEO/COO/admin and so
--     omits CFO — pre-existing drift, recorded in the build's check.md, not widened here.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ─── preflight: stop loudly if the live schema is not what this was written against ──────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='company_id') then
    raise exception 'RSS preflight: public.profiles.company_id not found - stop and re-read the live schema';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='sales_coach_role') then
    raise exception 'RSS preflight: public.profiles.sales_coach_role not found';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='status') then
    raise exception 'RSS preflight: public.profiles.status not found (expected from 0008)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'admin_roles') then
    raise exception 'RSS preflight: public.admin_roles() not found (expected from 0265)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='pitch_scores' and column_name='rep_id') then
    raise exception 'RSS preflight: public.pitch_scores.rep_id not found';
  end if;
end $$;

-- ─── 1. reporting tree ───────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists manager_id uuid references public.profiles(id) on delete set null;
comment on column public.profiles.manager_id is
  'RSS: who this person reports to. Null = top of tree or not yet set. Same company only; no loops (trigger).';
create index if not exists profiles_manager_id_idx on public.profiles (manager_id);

create or replace function public.rss_guard_manager() returns trigger
  language plpgsql set search_path = public as $$
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

drop trigger if exists rss_guard_manager on public.profiles;
create trigger rss_guard_manager before insert or update of manager_id, company_id on public.profiles
  for each row execute function public.rss_guard_manager();

-- manager_id IS AN ACCESS-BEARING COLUMN, so it joins the privileged-column guard (0090/0091).
-- The 0001 profiles policy lets every user update their OWN row. Without this, a rep could set their own
-- manager_id to a friendly colleague and drop out of their real manager's view once the tree is switched
-- on — the scaffold did not cover this. Only privileged writers (the service-role set-manager route,
-- definer RPCs) may set it. Every existing check below is 0091's, verbatim; manager_id is the only addition.
create or replace function guard_profile_privileged_columns()
returns trigger language plpgsql as $$
begin
  -- Privileged / definer / service-role writers pass untouched. Only direct
  -- PostgREST end-user requests arrive as 'authenticated' / 'anon'.
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    -- A direct end-user insert may only recreate the safe empty shell. role
    -- DEFAULTS to 'CEO', so it must be explicitly null here; is_support_agent is
    -- NOT NULL DEFAULT false, so its safe value is false, not null.
    if NEW.role is not null then
      raise exception 'profiles.role is system-managed; a direct insert may not set it (it defaults to CEO — must be null)';
    end if;
    if NEW.company_id is not null then
      raise exception 'profiles.company_id is system-managed (set via onboarding / invite acceptance), not settable on a direct insert';
    end if;
    if NEW.sales_coach_role is not null then
      raise exception 'profiles.sales_coach_role is admin-managed, not settable on insert';
    end if;
    if NEW.is_support_agent is distinct from false then
      raise exception 'profiles.is_support_agent is admin-managed, not settable on insert';
    end if;
    if NEW.manager_id is not null then
      raise exception 'profiles.manager_id is admin-managed (Team page), not settable on insert';
    end if;
    return NEW;
  end if;

  -- UPDATE: the authz-bearing columns may not CHANGE.
  if NEW.role is distinct from OLD.role then
    raise exception 'profiles.role is system-managed (set via onboarding / invite acceptance), not directly settable';
  end if;
  if NEW.company_id is distinct from OLD.company_id then
    raise exception 'profiles.company_id is system-managed (set via onboarding / invite acceptance), not directly settable';
  end if;
  if NEW.sales_coach_role is distinct from OLD.sales_coach_role then
    raise exception 'profiles.sales_coach_role is admin-managed, not directly settable';
  end if;
  if NEW.is_support_agent is distinct from OLD.is_support_agent then
    raise exception 'profiles.is_support_agent is admin-managed, not directly settable';
  end if;
  if NEW.manager_id is distinct from OLD.manager_id then
    raise exception 'profiles.manager_id is admin-managed (Team page), not directly settable';
  end if;

  return NEW;
end $$;

comment on function guard_profile_privileged_columns() is
  'Freezes role/company_id/sales_coach_role/is_support_agent/manager_id against direct authenticated/anon PostgREST writes on INSERT and UPDATE (0001 policies do not constrain these columns; role defaults to CEO). Privileged writers — SECURITY DEFINER RPCs and service-role routes — pass through. See 0090, 0091, 0272.';

-- Helpers: SECURITY DEFINER so they read profiles regardless of the caller's profile policies; booleans only.
create or replace function public.rss_is_company_admin(uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.role = any (admin_roles()) and p.status <> 'removed')
$$;

create or replace function public.rss_is_manager(uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.status <> 'removed'
                 and (p.sales_coach_role = 'admin' or p.role = any (admin_roles())))
$$;

create or replace function public.rss_is_below(manager uuid, person uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  with recursive up as (
    select p.manager_id as id, 1 as depth from profiles p where p.id = person
    union all
    select p.manager_id, up.depth + 1 from profiles p join up on p.id = up.id
    where up.id is not null and up.depth < 64
  )
  select exists (select 1 from up where up.id = manager)
$$;

-- THE access rule. D2 (decided): company admins keep company-wide view.
-- Answers only for the caller: a client passing someone else's id as `viewer` gets false.
create or replace function public.rss_can_view_rep(viewer uuid, rep uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select viewer is not null and rep is not null
    and (auth.uid() is null or viewer = auth.uid())
    and (select company_id from profiles where id = viewer) = (select company_id from profiles where id = rep)
    and (
      viewer = rep
      or rss_is_company_admin(viewer)
      or (rss_is_manager(viewer) and rss_is_below(viewer, rep))
    )
$$;

revoke all on function public.rss_is_company_admin(uuid) from public, anon, authenticated;
revoke all on function public.rss_is_manager(uuid) from public, anon, authenticated;
revoke all on function public.rss_is_below(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rss_guard_manager() from public, anon, authenticated;
revoke all on function public.rss_can_view_rep(uuid, uuid) from public, anon;
grant execute on function public.rss_can_view_rep(uuid, uuid) to authenticated, service_role;
grant execute on function public.rss_is_company_admin(uuid) to service_role;
grant execute on function public.rss_is_manager(uuid) to service_role;
grant execute on function public.rss_is_below(uuid, uuid) to service_role;

-- ─── 2. score provenance + archive ───────────────────────────────────────────────────────────
create table if not exists public.pitch_score_provenance (
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

create table if not exists public.pitch_score_archive (
  id uuid primary key default gen_random_uuid(),
  -- No FK on purpose: the live re-score path replaces the score's evidence rows (0254:117); a cascading
  -- FK could delete the very history this table exists to keep.
  pitch_score_id uuid not null,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  archived_payload jsonb not null,   -- the replaced score row + its evidence rows, as they were
  archived_by uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) >= 3),
  archived_at timestamptz not null default now()
);
create index if not exists pitch_score_archive_pitch_idx on public.pitch_score_archive (pitch_score_id, archived_at);
comment on table public.pitch_score_archive is
  'RSS: a re-score copies the old score and evidence here first (D3: keep old versions; flag, never re-apply, earlier overrides). Append-only.';

alter table public.pitch_score_provenance enable row level security;
alter table public.pitch_score_archive enable row level security;
drop policy if exists rss_provenance_select on public.pitch_score_provenance;
create policy rss_provenance_select on public.pitch_score_provenance for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id));
drop policy if exists rss_archive_select on public.pitch_score_archive;
create policy rss_archive_select on public.pitch_score_archive for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id));
-- No insert/update/delete policies: only the scorer (service role) writes. Append-only at the database:
create or replace rule pitch_score_archive_no_update as on update to public.pitch_score_archive do instead nothing;
create or replace rule pitch_score_archive_no_delete as on delete to public.pitch_score_archive do instead nothing;

-- ─── 3. login attempts ───────────────────────────────────────────────────────────────────────
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  ip inet,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_time_idx on public.login_attempts (email, created_at desc);
alter table public.login_attempts enable row level security;
-- Deliberately NO policies at all: only the server sign-in route (service role) reads or writes.
comment on table public.login_attempts is
  'RSS: one row per sign-in attempt. Lockout policy is D4 (NOT DECIDED); see src/lib/coach/remote/lockout.ts.';

-- ─── 4. AI cost ledger ───────────────────────────────────────────────────────────────────────
create table if not exists public.ai_usage (
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
create index if not exists ai_usage_session_idx on public.ai_usage (session_id);
create index if not exists ai_usage_company_day_idx on public.ai_usage (company_id, created_at);

create table if not exists public.ai_prices (
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
-- The vendor back office reads it through the service role.
