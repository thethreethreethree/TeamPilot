-- 0215_macro_mode_door_log_report_card.sql
--
-- Macro Mode (Door Log + Report Card) — a per-rep, toggle-able door-to-door mode of the Sales Coach.
-- Founder decisions (2026-08-18): Q2 consent = legally handled (NO in-flow gate); Q4 visibility =
-- rep + manager (owner-or-manager, mirroring coaching_sessions 0083/0084); toggle = per-rep alongside;
-- Q7 = full offline (client_knock_id idempotency). See docs/tbc/2026-08-18-macro-mode/.
--
-- Conforms to repo conventions (Phase 0 map): company_id tenancy · auth_company_id() · touch_*_updated_at
-- trigger · NO generic jobs table (pitches.status + run_after + a cron sweeper, mirroring
-- backfill-dissects-cron). Idempotent, forward-only. 5 tables + a KPI view. RLS on every table.

-- ── Enums (idempotent) ─────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'knock_outcome') then
    create type knock_outcome as enum
      ('no_answer','sold','go_back','non_decision_maker','not_interested');
  end if;
  if not exists (select 1 from pg_type where typname = 'pitch_status') then
    create type pitch_status as enum
      ('recorded','uploading','transcribing','analyzing','complete','failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'summary_period') then
    create type summary_period as enum ('day','week','month','all_time');
  end if;
end $$;

-- ── door_knocks — one row per door; the KPI source of truth ────────────────────
create table if not exists door_knocks (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null,
  rep_id          uuid not null references auth.users(id) on delete cascade,
  outcome         knock_outcome not null,
  knocked_at      timestamptz not null default now(),
  local_date      date not null,                    -- rep's local sales day (device tz, Q5 lean)
  client_knock_id text,                             -- offline idempotency key (Q7)
  created_at      timestamptz not null default now(),
  unique (rep_id, client_knock_id)
);

-- ── pitches — zero or one per knock; status+run_after drive the cron pipeline ───
create table if not exists pitches (
  id           uuid primary key default gen_random_uuid(),
  knock_id     uuid not null references door_knocks(id) on delete cascade,
  company_id   uuid not null,
  rep_id       uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  audio_path   text,                                -- path within ASSETS_BUCKET (reused)
  duration_ms  integer,
  status       pitch_status not null default 'recorded',
  attempts     integer not null default 0,          -- retry bookkeeping (backoff in retryBackoff.ts)
  run_after    timestamptz not null default now(),
  error        text,
  recorded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists pitches_knock_id_key on pitches (knock_id);
create index if not exists pitches_status_run_after_idx on pitches (status, run_after);

-- ── pitch_transcripts / pitch_analyses — service-role written only ─────────────
create table if not exists pitch_transcripts (
  pitch_id   uuid primary key references pitches(id) on delete cascade,
  company_id uuid not null,
  rep_id     uuid not null,
  text       text not null,
  language   text,
  word_count integer,
  provider   text not null default 'elevenlabs',
  created_at timestamptz not null default now()
);
create table if not exists pitch_analyses (
  pitch_id       uuid primary key references pitches(id) on delete cascade,
  company_id     uuid not null,
  rep_id         uuid not null,
  summary        text not null,
  strengths      jsonb not null default '[]'::jsonb,
  improvements   jsonb not null default '[]'::jsonb,
  scores         jsonb not null default '{}'::jsonb,   -- reuse the salesScore rubric dims (0..100)
  model          text not null,
  prompt_version text not null,
  created_at     timestamptz not null default now()
);

-- ── rep_pattern_summaries — the macro layer (feature centre of gravity) ─────────
create table if not exists rep_pattern_summaries (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  rep_id         uuid not null references auth.users(id) on delete cascade,
  period         summary_period not null,
  period_start   date not null,                       -- fixed sentinel date for all_time
  headline       text not null,
  patterns_good  jsonb not null default '[]'::jsonb,
  patterns_bad   jsonb not null default '[]'::jsonb,
  trend          jsonb not null default '{}'::jsonb,   -- vs previous period
  pitch_count    integer not null default 0,
  model          text,
  prompt_version text,
  generated_at   timestamptz not null default now(),
  unique (rep_id, period, period_start)
);

-- ── updated_at trigger (repo convention) ───────────────────────────────────────
create or replace function touch_pitches_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists pitches_updated_at on pitches;
create trigger pitches_updated_at before update on pitches
  for each row execute function touch_pitches_updated_at();

-- ── KPI view — aggregate door_knocks by rep + local_date (counts all six) ───────
create or replace view rep_kpi_daily as
  select company_id, rep_id, local_date,
         count(*)                                                as doors_knocked,
         count(*) filter (where outcome = 'sold')                as sold,
         count(*) filter (where outcome = 'go_back')             as go_backs,
         count(*) filter (where outcome = 'not_interested')      as not_interested,
         count(*) filter (where outcome = 'no_answer')           as no_answer,
         count(*) filter (where outcome = 'non_decision_maker')  as non_decision_maker
  from door_knocks group by company_id, rep_id, local_date;

-- ── RLS — enable on all 5 tables ───────────────────────────────────────────────
alter table door_knocks           enable row level security;
alter table pitches               enable row level security;
alter table pitch_transcripts     enable row level security;
alter table pitch_analyses        enable row level security;
alter table rep_pattern_summaries enable row level security;

-- Q4 = REP + MANAGER: a rep sees their own; a same-company CEO/COO/admin or sales_coach admin sees the
-- team (mirrors coaching_sessions 0084). Writes: reps insert their own knock/pitch (company_id pinned to
-- auth_company_id()); reps may rename their own pitch. Transcripts/analyses/summaries are SERVICE-ROLE
-- written only (no user insert/update policy) — the worker is the sole writer.

drop policy if exists "door_knocks - select" on door_knocks;
create policy "door_knocks - select" on door_knocks for select using (
  rep_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = door_knocks.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);
drop policy if exists "door_knocks - insert" on door_knocks;
create policy "door_knocks - insert" on door_knocks for insert
  with check (rep_id = auth.uid() and company_id = auth_company_id());

drop policy if exists "pitches - select" on pitches;
create policy "pitches - select" on pitches for select using (
  rep_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = pitches.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);
drop policy if exists "pitches - insert" on pitches;
create policy "pitches - insert" on pitches for insert
  with check (rep_id = auth.uid() and company_id = auth_company_id());
drop policy if exists "pitches - update own" on pitches;
create policy "pitches - update own" on pitches for update
  using (rep_id = auth.uid()) with check (rep_id = auth.uid());

drop policy if exists "pitch_transcripts - select" on pitch_transcripts;
create policy "pitch_transcripts - select" on pitch_transcripts for select using (
  exists (select 1 from pitches pi where pi.id = pitch_transcripts.pitch_id
    and ( pi.rep_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid()
               and p.company_id = pi.company_id
               and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin')) ))
);

drop policy if exists "pitch_analyses - select" on pitch_analyses;
create policy "pitch_analyses - select" on pitch_analyses for select using (
  exists (select 1 from pitches pi where pi.id = pitch_analyses.pitch_id
    and ( pi.rep_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid()
               and p.company_id = pi.company_id
               and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin')) ))
);

drop policy if exists "rep_pattern_summaries - select" on rep_pattern_summaries;
create policy "rep_pattern_summaries - select" on rep_pattern_summaries for select using (
  rep_id = auth.uid()
  or exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_pattern_summaries.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
);

-- Storage: pitch audio reuses the existing private ASSETS_BUCKET + signed-upload flow; object path
-- {company_id}/{rep_id}/{pitch_id}.webm. Storage RLS policies are added against the live bucket
-- definition in the pipeline step (they mirror the pitches select policy above).
