-- 0007 — Per-company brain + Month-1 control
--
-- Ratified by AMD-003. Implements §3.4 (behavior derived from each team's
-- accumulated data) and §3.6 (make learning visible).
--
-- Scope:
--   - companies.ai_guidance_enabled / ai_guidance_enabled_at: structural §3.4
--     Month-1 control gate. AI surfaces refuse to speak until day 30 (or until
--     the user manually flips the flag with full understanding of the trade).
--   - company_brain: the accumulated per-company memory injected into every LLM
--     call. Single row per company, mutable.
--   - brain_evolution_events: append-only log of every brain change with the
--     triggering evidence. Per §3.1 the audit trail is immutable.

-- ─────────────────────────────────────────────────────────────
-- Month-1 control gate
-- ─────────────────────────────────────────────────────────────

alter table companies
  add column if not exists ai_guidance_enabled boolean not null default false;
alter table companies
  add column if not exists ai_guidance_enabled_at timestamptz;
alter table companies
  add column if not exists ai_guidance_unlock_at timestamptz
    default (now() + interval '30 days');

-- ─────────────────────────────────────────────────────────────
-- company_brain — the runtime memory injected into every LLM call
-- ─────────────────────────────────────────────────────────────

create table if not exists company_brain (
  company_id              uuid primary key references companies(id) on delete cascade,
  version                 int not null default 1,

  -- Composed when learning runs. Injected into every LLM system prompt.
  system_prompt_addendum  text not null default '',

  -- Distilled structured knowledge, each entry traceable to its source.
  -- Shape: [{ "claim": "...", "source_event_ids": [...], "confidence": "high|medium|low",
  --           "derived_from": "held_resolution|dismissed_problem|dialogue|...",
  --           "learned_at": "..." }, ...]
  known_patterns          jsonb not null default '[]'::jsonb,

  -- Style + vocabulary that adapts how the System speaks to THIS company.
  -- Never affects whether it speaks (the gates), only how.
  style_calibration       jsonb not null default '{}'::jsonb,
  vocabulary              jsonb not null default '{}'::jsonb,

  -- Things the brain learned NOT to suggest (because prior suggestions were rejected
  -- with reasons). Each entry has the suggestion + the reason + the source.
  disabled_suggestions    jsonb not null default '[]'::jsonb,

  -- Diagnostic methods that have produced held resolutions for this company.
  -- Per §4: only counts if results held.
  validated_methods       jsonb not null default '[]'::jsonb,

  -- §3.6 — surfaced to the user
  last_learning_at        timestamptz,
  last_learning_summary   text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Auto-create an empty brain row when a company is created. The brain begins
-- empty by §3.4 design — no fixed day-one behavior.
create or replace function create_empty_brain_for_company()
returns trigger language plpgsql as $$
begin
  insert into company_brain (company_id) values (NEW.id)
    on conflict (company_id) do nothing;
  return NEW;
end $$;

drop trigger if exists companies_create_brain on companies;
create trigger companies_create_brain
  after insert on companies
  for each row execute function create_empty_brain_for_company();

-- ─────────────────────────────────────────────────────────────
-- brain_evolution_events — append-only learning audit trail
-- ─────────────────────────────────────────────────────────────

create table if not exists brain_evolution_events (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  kind            text not null,        -- 'pattern_learned', 'suggestion_disabled', 'method_validated', 'style_calibrated'
  claim           text not null,        -- one-line statement of what was learned
  reasoning       text not null,        -- the WHY behind this learning (Rule 2)
  source_event_ids uuid[] not null default '{}',
  source_resolution_ids uuid[] not null default '{}',
  confidence      text not null check (confidence in ('high','medium','low')),
  brain_version_before int,
  brain_version_after  int,
  recorded_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists brain_evolution_company_idx
  on brain_evolution_events (company_id, created_at desc);

create or replace rule brain_evolution_no_update as
  on update to brain_evolution_events do instead nothing;
create or replace rule brain_evolution_no_delete as
  on delete to brain_evolution_events do instead nothing;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table company_brain          enable row level security;
alter table brain_evolution_events enable row level security;

create policy "company_brain - all" on company_brain
  for all using (company_id = auth_company_id())
       with check (company_id = auth_company_id());

create policy "brain_evolution_events - all" on brain_evolution_events
  for all using (company_id = auth_company_id())
       with check (company_id = auth_company_id());

-- ─────────────────────────────────────────────────────────────
-- record_brain_learning() — the only sanctioned path to mutate the brain
--
-- This function:
--   1. Bumps the brain version
--   2. Inserts a brain_evolution_events row (append-only audit)
--   3. Updates the brain itself
-- All three in one transaction. The application MUST go through this function;
-- direct UPDATE on company_brain works but is non-auditable, which is a §3.1
-- violation. Application code is expected to never call UPDATE company_brain
-- directly except through this RPC.
-- ─────────────────────────────────────────────────────────────

create or replace function record_brain_learning(
  p_kind             text,
  p_claim            text,
  p_reasoning        text,
  p_confidence       text,
  p_addendum_delta   text default '',
  p_known_pattern    jsonb default null,
  p_disabled_suggestion jsonb default null,
  p_validated_method jsonb default null,
  p_source_event_ids uuid[] default '{}',
  p_source_resolution_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_company_id uuid;
  v_brain      record;
  v_event_id   uuid;
  v_new_version int;
begin
  v_company_id := auth_company_id();
  if v_company_id is null then
    raise exception 'record_brain_learning called without an authenticated company';
  end if;

  select * into v_brain from company_brain where company_id = v_company_id;
  if not found then
    raise exception 'company_brain row missing for %', v_company_id;
  end if;

  v_new_version := v_brain.version + 1;

  -- Append the audit event first.
  insert into brain_evolution_events (
    company_id, kind, claim, reasoning, confidence,
    source_event_ids, source_resolution_ids,
    brain_version_before, brain_version_after, recorded_by
  ) values (
    v_company_id, p_kind, p_claim, p_reasoning, p_confidence,
    p_source_event_ids, p_source_resolution_ids,
    v_brain.version, v_new_version, auth.uid()
  ) returning id into v_event_id;

  -- Update the brain. The addendum delta is appended, never replaced — the
  -- composer reads the full addendum and the LLM is given it as a system prompt.
  update company_brain
    set version = v_new_version,
        system_prompt_addendum = case
          when length(p_addendum_delta) > 0
          then trim(both E'\n' from coalesce(system_prompt_addendum, '') || E'\n\n' || p_addendum_delta)
          else system_prompt_addendum
        end,
        known_patterns = case
          when p_known_pattern is not null
          then known_patterns || p_known_pattern
          else known_patterns
        end,
        disabled_suggestions = case
          when p_disabled_suggestion is not null
          then disabled_suggestions || p_disabled_suggestion
          else disabled_suggestions
        end,
        validated_methods = case
          when p_validated_method is not null
          then validated_methods || p_validated_method
          else validated_methods
        end,
        last_learning_at = now(),
        last_learning_summary = p_claim,
        updated_at = now()
    where company_id = v_company_id;

  return v_event_id;
end;
$$;
