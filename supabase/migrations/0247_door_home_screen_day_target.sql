-- 0247 — Door home screen (docs/2ND MAIN PANEL DASKBOARD): per-rep daily sales goal + frozen day target.
--
-- The door screen works a manager-set DAILY SALES GOAL back through the rep's 30-day close/contact ratios
-- (computed from the EXISTING door_knocks + pitches — no new activity table, per INSPECTION.md) into the day's
-- door/presentation/sold targets, frozen once at the rep's first open of the day. Two tables:
--
--   rep_daily_sales_goal  — the standing per-rep goal a MANAGER sets (Q1: manager sets it per rep).
--   rep_day_target        — the frozen targets for a rep on a local day (03/05: a target that moves during the
--                           day rewards stopping, so it is computed once and stored).
--
-- Conventions mirror door_knocks/pitches (0215): company_id tenancy, auth_company_id(), and the same
-- same-company-manager predicate (profiles.role in CEO/COO/admin OR sales_coach_role='admin'). Additive + safe.

-- ── (1) rep_daily_sales_goal ────────────────────────────────────────────────────────────────────────────────
create table if not exists rep_daily_sales_goal (
  rep_id     uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null,
  sales_goal integer not null check (sales_goal > 0),
  set_by     uuid,
  updated_at timestamptz not null default now()
);
alter table rep_daily_sales_goal enable row level security;

-- Read: the rep, or a same-company manager.
drop policy if exists "rep_daily_sales_goal - select" on rep_daily_sales_goal;
create policy "rep_daily_sales_goal - select" on rep_daily_sales_goal for select using (
  rep_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);
-- Write: a same-company MANAGER only. A rep does NOT set their own goal (Q1). company_id pinned to the caller's.
drop policy if exists "rep_daily_sales_goal - manager insert" on rep_daily_sales_goal;
create policy "rep_daily_sales_goal - manager insert" on rep_daily_sales_goal for insert with check (
  company_id = auth_company_id()
  and exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);
drop policy if exists "rep_daily_sales_goal - manager update" on rep_daily_sales_goal;
create policy "rep_daily_sales_goal - manager update" on rep_daily_sales_goal for update using (
  exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
) with check (
  company_id = auth_company_id()
  and exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);

comment on table rep_daily_sales_goal is
  'Door home screen: the standing per-rep DAILY sales goal a manager sets (0247). The door target works back from it.';

-- ── (2) rep_day_target ──────────────────────────────────────────────────────────────────────────────────────
create table if not exists rep_day_target (
  rep_id               uuid not null references auth.users(id) on delete cascade,
  local_date           date not null,
  company_id           uuid not null,
  sales_goal           integer not null,
  close_ratio          numeric,
  contact_ratio        numeric,
  doors_target         integer not null,
  presentations_target integer not null,
  sold_target          integer not null,
  used_starter         boolean not null default false,
  computed_at          timestamptz not null default now(),
  primary key (rep_id, local_date)
);
alter table rep_day_target enable row level security;

-- Read: the rep, or a same-company manager.
drop policy if exists "rep_day_target - select" on rep_day_target;
create policy "rep_day_target - select" on rep_day_target for select using (
  rep_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_day_target.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);
-- Write: the REP freezes their OWN day target on the first open of their day (company_id pinned). Insert-only:
-- the primary key (rep_id, local_date) + `on conflict do nothing` at the call site keeps the target frozen.
drop policy if exists "rep_day_target - insert own" on rep_day_target;
create policy "rep_day_target - insert own" on rep_day_target for insert
  with check (rep_id = auth.uid() and company_id = auth_company_id());

comment on table rep_day_target is
  'Door home screen: the FROZEN door/presentation/sold targets for a rep on a local day (0247). Computed once at first open; never recomputed intra-day (a moving target rewards stopping).';
