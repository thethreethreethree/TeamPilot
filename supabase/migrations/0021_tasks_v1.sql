-- Tasks v1 — proper task structure.
--
-- Operationalizes the three pillars discussed with the user:
--   1. Pre-task Understanding Gate (§3.2 applied to work)
--   2. Accountability via presence (no surveillance — A7)
--   3. Guidance + encouragement (§3.3 — Coach inside the task thread)
--
-- Schema changes are additive (no DROP on existing columns), per §3.1
-- append-only spirit. Existing tasks land with gate_cleared = false
-- and gate_mode = null; an admin clears the gate by filling in the
-- structured fields. The legacy `assignee text` column stays for
-- backward compat; `task_participants` is the new model that supports
-- multi-person tasks.

-- ─── Gate fields on tasks ────────────────────────────────────────
-- Per Pillar 1: a task can't move out of "draft" until the gate is
-- cleared. "Small" mode requires only one-sentence what + assignee +
-- deadline; "real" mode requires the full structure. The §4 readout
-- will tell us whether the small-mode escape hatch undermines the
-- gate or rescues it (A4 — defer to evidence).

alter table tasks add column if not exists gate_cleared boolean not null default false;
alter table tasks add column if not exists gate_mode text;
alter table tasks add column if not exists gate_what text;
alter table tasks add column if not exists gate_resources text;
alter table tasks add column if not exists gate_roles text;

-- gate_mode constraint — only valid values, plus null (not yet set).
alter table tasks drop constraint if exists tasks_gate_mode_check;
alter table tasks add constraint tasks_gate_mode_check
  check (gate_mode is null or gate_mode in ('small', 'real'));

comment on column tasks.gate_cleared is
  'When false, the task is still in "draft" — has not yet passed the §3.2 Understanding Gate. UI prevents the task from being acted on until cleared.';
comment on column tasks.gate_mode is
  'Either "small" (one-sentence what + assignee + deadline only) or "real" (full What/Resources/Roles structure). Null means the gate has not been attempted yet.';
comment on column tasks.gate_what is
  'Pillar 1 answer: what are we trying to accomplish? Required for both gate modes.';
comment on column tasks.gate_resources is
  'Pillar 1 answer: what tools / assets / resources do we have? Required for "real" mode; optional for "small".';
comment on column tasks.gate_roles is
  'Pillar 1 answer: who is involved and what are their roles + responsibilities? Required for "real" mode.';

-- ─── task_participants ───────────────────────────────────────────
-- Many-to-many participants (vs the legacy single `assignee` column).
-- Tracks last_engaged_at per (task, user) for Pillar 2. Engagement is
-- updated by *meaningful* actions only — status changes, comments,
-- attachments — never page views. Page views are surveillance.

create table if not exists task_participants (
  task_id           uuid not null references tasks(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              text not null default 'member'
                    check (role in ('owner', 'member', 'observer')),
  joined_at         timestamptz not null default now(),
  left_at           timestamptz,
  -- Pillar 2: meaningful-action engagement only.
  last_engaged_at   timestamptz,
  -- For the §4 readout: how many meaningful actions has this person
  -- taken on the task?
  engagement_count  int not null default 0,
  primary key (task_id, user_id)
);

create index if not exists task_participants_user_idx
  on task_participants (user_id, last_engaged_at desc);

-- ─── task_messages ───────────────────────────────────────────────
-- The communication thread inside the task. Append-only at the SQL
-- layer per §3.1 — no edits, no deletes, the conversation is the
-- record. The trigger that emits chain events (below) makes every
-- post part of the §3.1 audit trail.

create table if not exists task_messages (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete set null,
  kind         text not null default 'message'
               check (kind in ('message', 'system', 'gate_cleared', 'status_changed', 'nudge')),
  body         text,
  -- Payload for system/structured messages — e.g. status transitions
  -- record { from: "To Do", to: "In Progress" }.
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists task_messages_task_created_idx
  on task_messages (task_id, created_at desc);

-- §3.1 append-only rules.
create or replace rule task_messages_no_update as
  on update to task_messages do instead nothing;
create or replace rule task_messages_no_delete as
  on delete to task_messages do instead nothing;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table task_participants enable row level security;
alter table task_messages     enable row level security;

-- Participants: any company member can see the participant roster for
-- a task in their company (same model as chat_participants).
create policy "task_participants - select" on task_participants
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_participants.task_id
        and t.company_id = auth_company_id()
    )
  );

create policy "task_participants - insert" on task_participants
  for insert with check (
    exists (
      select 1 from tasks t
      where t.id = task_participants.task_id
        and t.company_id = auth_company_id()
    )
  );

create policy "task_participants - update" on task_participants
  for update using (
    exists (
      select 1 from tasks t
      where t.id = task_participants.task_id
        and t.company_id = auth_company_id()
    )
  );

-- Messages: company members see messages for tasks in their company.
-- Stricter participant-only gating would mirror chat_messages; here
-- we keep it company-wide because tasks are typically broader than
-- private threads. Can tighten later.
create policy "task_messages - select" on task_messages
  for select using (company_id = auth_company_id());

create policy "task_messages - insert" on task_messages
  for insert with check (company_id = auth_company_id());

-- ─── Chain emission ──────────────────────────────────────────────
-- Every task_messages insert emits one §3.1 event. The kind on the
-- event mirrors the message kind so the readout can filter cleanly.

create or replace function task_message_emit_event()
returns trigger
language plpgsql
security definer
as $$
declare
  v_kind text;
begin
  v_kind := case NEW.kind
    when 'gate_cleared'    then 'task.gate_cleared'
    when 'status_changed'  then 'task.status_changed'
    when 'nudge'           then 'task.nudge_sent'
    when 'system'          then 'task.system_message'
    else                        'task.message_posted'
  end;

  insert into events (company_id, kind, subject, actor, payload, occurred_at)
  values (
    NEW.company_id,
    v_kind,
    'task:' || NEW.task_id::text,
    NEW.author_id,
    NEW.payload || jsonb_build_object(
      'task_message_id', NEW.id,
      'message_kind', NEW.kind
    ),
    NEW.created_at
  );
  return NEW;
end;
$$;

drop trigger if exists task_message_emit_event_trigger on task_messages;
create trigger task_message_emit_event_trigger
  after insert on task_messages
  for each row execute function task_message_emit_event();

-- ─── signal_sources for task events ──────────────────────────────
-- Conservative — only one mapping in v1, expand based on evidence
-- per A4. status_changed to "Blocked" is direct friction; we want
-- it to accumulate toward problem status via §3.2 Gate.

insert into signal_sources (event_kind, signal_kind, predicate, source_template, notes)
values (
  'task.status_changed',
  'user_friction',
  '{"to":"Blocked"}'::jsonb,
  'task:${payload.task_id}',
  'A task transitioned to Blocked. Direct friction evidence; multiple blocks accumulate toward problem status via §3.2.'
)
on conflict do nothing;
