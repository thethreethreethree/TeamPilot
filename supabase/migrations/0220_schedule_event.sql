-- 0220 — Schedule Management System, Phase 1: the append-only event log (CLAUDE.md 3.1)
--
-- The foundation of the scheduling module. Everything a manager or employee does to a schedule
-- (define a shift, assign someone, request/approve time off, set availability, define coverage,
-- request/approve a swap) is recorded here as an IMMUTABLE event. Schedule state (shifts,
-- assignments, time-off, availability, coverage requirements) is DERIVED by replaying this log
-- (src/lib/schedule/deriveState.ts) — never edited in place. A correction is a NEW event
-- (e.g. EMPLOYEE_UNASSIGNED then EMPLOYEE_ASSIGNED), never an UPDATE.
--
-- Tenancy: company_id (the platform-wide key, 166 prior migrations; org_id is not used anywhere).
-- The build plan's "org_id" maps to company_id. A per-location sub-org has no precedent and is a
-- future, non-breaking, event-sourced addition if ever needed.
--
-- Append-only is enforced at the DB, fail-LOUD (build plan + 3.4): unlike 0004_events.sql, which
-- uses `do instead nothing` rules (a silent no-op that lets a caller believe an UPDATE succeeded),
-- this table RAISES on any UPDATE/DELETE via a trigger AND revokes the privileges. A silent
-- append-only is an honesty failure (an "error dressed as success"); this one is visible.

create table if not exists schedule_event (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  -- Domain event type (SHIFT_DEFINED, EMPLOYEE_ASSIGNED, TIMEOFF_REQUESTED, ...). Kept as text,
  -- not an enum/check: the type set evolves per phase, and the APPEND API validates it against a
  -- TS schema before insert (validation at the boundary, per the plan's "validates + appends").
  type        text not null,
  -- Who performed the action. NULL only for system-originated events. Attribution AT THE SOURCE
  -- (A39): the event records WHO, so no downstream consumer has to reconstruct it.
  actor_id    uuid references auth.users(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  -- When the action logically occurred (may be back-dated by a caller); created_at is the wall
  -- clock of the insert. Causal replay order is `seq`, not either timestamp.
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- Globally monotonic, gap-tolerant, race-safe insertion order (a Postgres identity sequence).
  -- Replay orders by (company_id, seq). Never reused, never reordered.
  seq         bigint generated always as identity
);

create index if not exists schedule_event_company_seq_idx
  on schedule_event (company_id, seq);
create index if not exists schedule_event_company_type_idx
  on schedule_event (company_id, type);
create index if not exists schedule_event_occurred_idx
  on schedule_event (company_id, occurred_at desc);

-- ── Append-only enforcement (fail-loud) ──────────────────────────────────────
-- A trigger that RAISES on UPDATE/DELETE (visible failure), plus revoked privileges. The trigger
-- is the real guard (fires regardless of role, including service_role); the revoke is defence in
-- depth at the grant layer.
create or replace function schedule_event_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'schedule_event is append-only: % is not permitted (record a NEW correcting event instead)', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists schedule_event_no_update_delete on schedule_event;
create trigger schedule_event_no_update_delete
  before update or delete on schedule_event
  for each row execute function schedule_event_reject_mutation();

revoke update, delete on schedule_event from authenticated, anon;

-- ── RLS (tenant isolation) ───────────────────────────────────────────────────
alter table schedule_event enable row level security;

drop policy if exists "schedule_event tenant" on schedule_event;
create policy "schedule_event tenant" on schedule_event
  for all
  using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ── append_schedule_event() — convenience appender ───────────────────────────
-- Security INVOKER (enforces the caller's RLS, never bypasses it). company_id is derived from the
-- caller's own company so the app cannot write an event for a company it does not belong to.
-- The APPEND API still validates the type + payload shape BEFORE calling this.
create or replace function append_schedule_event(
  p_type    text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_company_id uuid;
  v_id         uuid;
begin
  v_company_id := auth_company_id();
  if v_company_id is null then
    raise exception 'append_schedule_event called without an authenticated company context';
  end if;

  insert into schedule_event (company_id, type, actor_id, payload)
    values (v_company_id, p_type, auth.uid(), p_payload)
    returning id into v_id;

  return v_id;
end;
$$;
