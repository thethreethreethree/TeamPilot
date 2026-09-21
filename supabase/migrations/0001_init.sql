-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

-- ExecOS initial schema
-- Run this in the Supabase SQL Editor (or via the Supabase CLI).

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists companies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  industry          text,
  size              text,
  stage             text,
  health_score      int  default 0,
  operations_score  int  default 0,
  team_score        int  default 0,
  finance_score     int  default 0,
  marketing_score   int  default 0,
  created_at        timestamptz default now()
);

-- One profile per auth user. company_id links them to their org.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid references companies(id) on delete set null,
  full_name   text,
  role        text default 'CEO',
  created_at  timestamptz default now()
);

create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  title             text not null,
  description       text,
  department        text,
  assignee          text,
  status            text default 'To Do',
  priority          text default 'Medium',
  ai_priority_score int  default 0,
  impact_level      text default 'Medium',
  blocker_reason    text,
  due_date          date,
  created_at        timestamptz default now()
);

create table if not exists team_members (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  name              text not null,
  role              text,
  department        text,
  active_tasks      int default 0,
  completed_tasks   int default 0,
  overdue_tasks     int default 0,
  blocked_tasks     int default 0,
  workload_level    text default 'Balanced',
  consistency_score int default 0,
  performance_score int default 0,
  created_at        timestamptz default now()
);

create table if not exists decisions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  title            text not null,
  situation        text,
  outcome          text,
  execution_status text default 'In Progress',
  options          jsonb,
  created_at       timestamptz default now()
);

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  raw_text    text,
  analysis    jsonb,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Helper: the company_id of the currently authenticated user
-- ─────────────────────────────────────────────────────────────

create or replace function auth_company_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select company_id from profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table companies     enable row level security;
alter table profiles      enable row level security;
alter table tasks         enable row level security;
alter table team_members  enable row level security;
alter table decisions     enable row level security;
alter table conversations enable row level security;

-- profiles: a user can read/update only their own profile.
drop policy if exists "own profile - select" on profiles;
create policy "own profile - select" on profiles
  for select using (id = auth.uid());
drop policy if exists "own profile - insert" on profiles;
create policy "own profile - insert" on profiles
  for insert with check (id = auth.uid());
drop policy if exists "own profile - update" on profiles;
create policy "own profile - update" on profiles
  for update using (id = auth.uid());

-- companies: members can read; any authenticated user can create one.
drop policy if exists "company - select" on companies;
create policy "company - select" on companies
  for select using (id = auth_company_id());
drop policy if exists "company - insert" on companies;
create policy "company - insert" on companies
  for insert with check (auth.uid() is not null);
drop policy if exists "company - update" on companies;
create policy "company - update" on companies
  for update using (id = auth_company_id());

-- Generic per-company access for the data tables.
do $$
declare t text;
begin
  foreach t in array array['tasks','team_members','decisions','conversations']
  loop
    execute format(
      'drop policy if exists "%1$s - all" on %1$s;', t);
    execute format(
      'create policy "%1$s - all" on %1$s for all
         using (company_id = auth_company_id())
         with check (company_id = auth_company_id());', t);
  end loop;
end $$;
