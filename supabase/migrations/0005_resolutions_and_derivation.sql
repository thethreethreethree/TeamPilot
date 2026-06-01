-- 0005 — Resolutions + Signal Derivation
--
-- Closes the chain CLAUDE.md §3.1 mandates:
--   events → signals → problems → resolutions → (new events)
--
-- The resolutions table is the missing fourth link. Without it the chain is open —
-- problems can be marked resolved but the *outcome* of the resolution (did it
-- actually work? did the problem reopen?) has no place to live. That makes §3.5
-- (measurement of consequence) structurally impossible.
--
-- Also adds the signal derivation function: a way for events to systematically
-- produce signals, so the schema chain runs end-to-end and the diagnosis engine
-- has something to operate on.
--
-- This migration does NOT auto-derive signals from arbitrary events — that requires
-- a per-kind derivation rule which is a future amendment-scoped decision. It
-- provides the scaffolding.

-- ─────────────────────────────────────────────────────────────
-- resolutions: the close-the-loop record
-- ─────────────────────────────────────────────────────────────

create table if not exists resolutions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  problem_id    uuid not null references problems(id) on delete cascade,
  action_taken  text not null,             -- WHAT was done
  reasoning     text not null,             -- WHY (Rule 2). Required, not optional.
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz not null default now(),

  -- Consequence tracking (Rule 3.5):
  expected_outcome text,                   -- What we expected to happen
  observed_outcome text,                   -- What actually happened (filled later)
  durability       text check (durability in ('held','reopened','partial','unknown')),
  reviewed_at      timestamptz,
  reviewer         uuid references auth.users(id) on delete set null,

  created_at    timestamptz not null default now()
);

create index if not exists resolutions_company_decided_idx
  on resolutions (company_id, decided_at desc);

create index if not exists resolutions_problem_idx
  on resolutions (problem_id);

-- The action_taken / reasoning / decided_at are append-only after creation.
-- observed_outcome / durability / reviewed_at / reviewer can be filled later.
create or replace function check_resolution_immutability()
returns trigger language plpgsql as $$
begin
  if OLD.action_taken is distinct from NEW.action_taken then
    raise exception 'resolutions.action_taken is immutable';
  end if;
  if OLD.reasoning is distinct from NEW.reasoning then
    raise exception 'resolutions.reasoning is immutable';
  end if;
  if OLD.decided_at is distinct from NEW.decided_at then
    raise exception 'resolutions.decided_at is immutable';
  end if;
  return NEW;
end $$;

drop trigger if exists resolutions_immutable on resolutions;
create trigger resolutions_immutable
  before update on resolutions
  for each row execute function check_resolution_immutability();

-- RLS
alter table resolutions enable row level security;

create policy "resolutions - all" on resolutions
  for all
  using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ─────────────────────────────────────────────────────────────
-- signal_sources: registry of derivation rules
--
-- A signal_source declares: "events of kind X, optionally filtered by payload
-- predicate, produce signals of kind Y". The diagnosis engine queries this table
-- when scanning events for derivable signals.
-- ─────────────────────────────────────────────────────────────

create table if not exists signal_sources (
  id              uuid primary key default gen_random_uuid(),
  event_kind      text not null,
  signal_kind     text not null,
  predicate       jsonb,                       -- jsonpath-like filter on payload (optional)
  source_template text not null,               -- e.g. 'task:${payload.task_id}' — templated source string
  notes           text,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (event_kind, signal_kind)
);

-- Seed a few defensible default rules. These are intentionally narrow — broad
-- "everything is a signal" rules generate noise that violates §3.2 in spirit.
insert into signal_sources (event_kind, signal_kind, source_template, notes) values
  ('task.status_changed', 'task_blocked', 'task:${payload.task_id}',
   'A task transitioning to status=Blocked is a signal that something is stuck.'),
  ('task.overran_due_date', 'task_slipped', 'task:${payload.task_id}',
   'A task crossing its due date without completion is a signal.'),
  ('meeting.overran', 'meeting_overran', 'meeting:${payload.meeting_id}',
   'A meeting that ran past its scheduled duration is a signal about coordination cost.')
on conflict (event_kind, signal_kind) do nothing;

-- ─────────────────────────────────────────────────────────────
-- derive_signals_for_event: given an event id, produce the signals that derive
-- from it according to signal_sources. Returns the inserted signal ids.
-- ─────────────────────────────────────────────────────────────

create or replace function derive_signals_for_event(p_event_id uuid)
returns setof uuid
language plpgsql
security invoker
as $$
declare
  v_event   record;
  v_rule    record;
  v_source  text;
  v_signal  uuid;
begin
  select * into v_event from events where id = p_event_id;
  if not found then return; end if;

  for v_rule in
    select * from signal_sources
    where event_kind = v_event.kind and enabled = true
  loop
    -- Render the source template. Minimal jq-like substitution: ${payload.<key>}.
    v_source := v_rule.source_template;
    v_source := regexp_replace(
      v_source,
      '\$\{payload\.([a-zA-Z0-9_]+)\}',
      coalesce(v_event.payload ->> 'task_id', v_event.payload ->> 'meeting_id', 'unknown'),
      'g'
    );

    insert into signals (company_id, kind, source, payload, observed_at)
      values (v_event.company_id, v_rule.signal_kind, v_source, v_event.payload, v_event.occurred_at)
      returning id into v_signal;

    return next v_signal;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- close_problem: append the resolution AND emit a problem.resolved event.
-- Rule 3.1: resolutions feed back as new events into the chain.
-- ─────────────────────────────────────────────────────────────

create or replace function close_problem(
  p_problem_id       uuid,
  p_action_taken     text,
  p_reasoning        text,
  p_expected_outcome text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_company_id  uuid;
  v_resolution  uuid;
begin
  select company_id into v_company_id from problems where id = p_problem_id;
  if v_company_id is null then
    raise exception 'close_problem: problem % not found or not accessible', p_problem_id;
  end if;

  -- Append the resolution.
  insert into resolutions (
    company_id, problem_id, action_taken, reasoning, expected_outcome, decided_by
  ) values (
    v_company_id, p_problem_id, p_action_taken, p_reasoning, p_expected_outcome, auth.uid()
  ) returning id into v_resolution;

  -- Mark the problem resolved.
  update problems
    set status = 'resolved',
        resolved_at = now(),
        updated_at = now()
    where id = p_problem_id;

  -- Emit the closing event so the loop closes (Rule 3.1: "resolutions → (new events)").
  perform record_event(
    'problem.resolved',
    'problem:' || p_problem_id::text,
    jsonb_build_object(
      'problem_id', p_problem_id,
      'resolution_id', v_resolution,
      'action_taken', p_action_taken
    )
  );

  return v_resolution;
end;
$$;
