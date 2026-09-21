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

-- 0004 — Events (append-only foundation under signals)
--
-- Encodes §3.1:
--   "Everything is an event. Events are append-only. Never update or delete — append.
--    Entity state (tasks, projects, people) is derived by replaying events, never
--    edited directly. Core chain: events → signals → problems → resolutions →
--    (new events). This chain *is* the method encoded as schema."
--
-- Scope of this migration:
--   - Create the events table with strict append-only rules.
--   - Provide a helper to record an event from anywhere in the app.
--   - Do NOT refactor existing tables (tasks, team_members, decisions) into
--     projections yet. They remain as state tables; events run alongside them.
--     Refactoring to projections is a larger amendment-scoped change (a separate
--     amendment with its own ripple-trace must be written first).

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null,             -- e.g. 'task.created', 'task.status_changed',
                                          --      'meeting.completed', 'comment.posted'
  subject     text not null,             -- e.g. 'task:<uuid>', 'meeting:<uuid>'
  actor       uuid references auth.users(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists events_company_occurred_idx
  on events (company_id, occurred_at desc);

create index if not exists events_subject_idx on events (subject);
create index if not exists events_kind_idx on events (kind);

-- Append-only at the SQL layer. Rule §3.1 is enforced, not requested.
create or replace rule events_no_update as on update to events do instead nothing;
create or replace rule events_no_delete as on delete to events do instead nothing;

-- RLS
alter table events enable row level security;

drop policy if exists "events - all" on events;
create policy "events - all" on events
  for all
  using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- ─────────────────────────────────────────────────────────────
-- record_event() — convenience for application code.
-- Returns the new event id. company_id is derived from the caller's profile so the
-- application cannot accidentally write events for a company it does not belong to.
-- ─────────────────────────────────────────────────────────────

create or replace function record_event(
  p_kind     text,
  p_subject  text,
  p_payload  jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker  -- enforces caller's RLS, do not bypass.
as $$
declare
  v_company_id uuid;
  v_id         uuid;
begin
  v_company_id := auth_company_id();
  if v_company_id is null then
    raise exception 'record_event called without an authenticated company context';
  end if;

  insert into events (company_id, kind, subject, actor, payload)
    values (v_company_id, p_kind, p_subject, auth.uid(), p_payload)
    returning id into v_id;

  return v_id;
end;
$$;
