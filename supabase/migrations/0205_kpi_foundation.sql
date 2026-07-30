-- 0205 — KPI Analytics foundation (SalesCoach-KPI-System.md, Phase 1). Founder-confirmed 2026-07-30.
--
-- The KPI system is mostly a DERIVATION layer over data that already exists (coaching_sessions,
-- coaching_transcript_segments, coaching_cues/_outcomes, after_pitch_summaries.scores, the self-ELO).
-- This migration adds the two things that DON'T exist yet:
--   (A) a per-session sales OUTCOME (coaching_sessions has none) — Layer 1 needs it.
--   (B) the computed self-baseline layer: agent_baseline, kpi_snapshot, growth_record.
--
-- SECURITY MODEL (mirrors 0113's ELO hardening): the computed tables are written ONLY by the scheduled
-- service-role jobs (which bypass RLS). Members get RLS SELECT of their OWN rows; managers (company admin
-- OR sales_coach admin) see the team. There is NO member INSERT/UPDATE policy → with RLS enabled, members
-- cannot self-fabricate a baseline or snapshot (the exact self-inflation vector 0113 closed for ELO).
-- Everything is additive + safe: default outcome is NULL (unknown), so nothing changes for existing rows.

-- (A) Per-session outcome. NULL = not yet recorded (a valid, honest state — never a guessed win/loss).
-- deal_value is numeric (exact-decimal — money is never float, per the spec + the finance discipline).
alter table if exists public.coaching_sessions
  add column if not exists outcome text
    check (outcome in ('won', 'lost', 'no_decision')),
  add column if not exists deal_value numeric(14, 2)
    check (deal_value is null or deal_value >= 0);

comment on column public.coaching_sessions.outcome is
  'Sales outcome for Layer-1 KPIs, set by the rep at/after session end. NULL = not recorded (valid state).';

-- (B) agent_baseline — per-agent rolling statistics per metric. The foundation of self-comparison.
create table if not exists public.agent_baseline (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  agent_id      uuid not null references public.profiles(id) on delete cascade,
  metric        text not null,
  rolling_mean  numeric,
  rolling_stddev numeric,
  sample_size   integer not null default 0,
  window_label  text not null default 'all',
  last_computed timestamptz not null default now(),
  unique (company_id, agent_id, metric, window_label)
);
create index if not exists agent_baseline_agent_idx
  on public.agent_baseline (company_id, agent_id, metric);

-- kpi_snapshot — a computed metric value with its baseline + delta + drill-down source sessions. Append-only
-- (the spec keeps source_session_ids for traceability); confidence null until the Understanding Gate passes.
create table if not exists public.kpi_snapshot (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  agent_id          uuid not null references public.profiles(id) on delete cascade,
  metric            text not null,
  layer             smallint not null check (layer between 1 and 4),
  value             numeric,
  period            text not null,
  baseline_value    numeric,
  delta_vs_baseline numeric,
  sample_size       integer not null default 0,
  confidence        numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_session_ids uuid[] not null default '{}',
  computed_at       timestamptz not null default now()
);
create index if not exists kpi_snapshot_agent_idx
  on public.kpi_snapshot (company_id, agent_id, metric, period, computed_at desc);

-- growth_record — per-metric trajectory + milestones over time (Reliance Reduction lives here).
create table if not exists public.growth_record (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  agent_id     uuid not null references public.profiles(id) on delete cascade,
  metric       text not null,
  trajectory   jsonb not null default '[]',
  milestone    text,
  period       text not null,
  computed_at  timestamptz not null default now()
);
create index if not exists growth_record_agent_idx
  on public.growth_record (company_id, agent_id, metric, computed_at desc);

-- RLS: read own (agent) or team (manager); NO member write (service-role jobs write, bypassing RLS).
alter table public.agent_baseline enable row level security;
alter table public.kpi_snapshot enable row level security;
alter table public.growth_record enable row level security;

drop policy if exists "agent_baseline - select own or manager" on public.agent_baseline;
create policy "agent_baseline - select own or manager" on public.agent_baseline
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = agent_baseline.company_id
        and (agent_baseline.agent_id = p.id
             or p.role in ('CEO', 'COO', 'admin')
             or p.sales_coach_role = 'admin')
    )
  );

drop policy if exists "kpi_snapshot - select own or manager" on public.kpi_snapshot;
create policy "kpi_snapshot - select own or manager" on public.kpi_snapshot
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = kpi_snapshot.company_id
        and (kpi_snapshot.agent_id = p.id
             or p.role in ('CEO', 'COO', 'admin')
             or p.sales_coach_role = 'admin')
    )
  );

drop policy if exists "growth_record - select own or manager" on public.growth_record;
create policy "growth_record - select own or manager" on public.growth_record
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = growth_record.company_id
        and (growth_record.agent_id = p.id
             or p.role in ('CEO', 'COO', 'admin')
             or p.sales_coach_role = 'admin')
    )
  );
