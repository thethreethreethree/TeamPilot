-- 0032 — Tasks triad foundation (Pillars 2 + 3 of §A6)
--
-- The current task system has Pillar 1 (Understanding Gate from 0021)
-- and bare-bones CRUD. §A6 names this the bureaucracy failure mode —
-- shipping the gate alone produces gate-questions with no follow-
-- through. This migration lays the schema for Pillars 2 (Accountability
-- via interactive progress + self-view) and 3 (Guidance via per-step
-- Coach + A18 labels), so the triad can ship as one coherent surface.
--
-- Constitutional grounding per asset:
--   §A6  : ship the triad together; single-pillar shipping is the
--          failure mode of that pillar.
--   §A7  : every metric surfaces WITH a constructive next step —
--          the schema records the data; the UI layer never displays
--          it standalone.
--   §A10 : participants see what the System sees about them — the
--          per-user engagement read is on the chain, no shadow read.
--   §A11 : counts, not verdicts — completion ratio is a fact, not a
--          rating; the UI renders it as momentum, not a grade.
--   §A18 : status labels invite behavior — the existing 'Blocked'
--          stays in the data (for the chain) but the UI maps it to
--          'Requesting Collaboration' so the room responds with
--          partnership, not pressure.
--
-- A12 idempotent: every add column / table / constraint / trigger
-- uses if-not-exists or create-or-replace; safe to re-run.

-- ─── Tasks: new columns ─────────────────────────────────────────

-- assignee_user_id — proper FK on profiles, complementing the legacy
-- text `assignee` field. Both exist during the transition window so
-- legacy task creators (UIs not yet updated) still work. The text
-- column will be deprecated in a follow-up migration once every
-- read-site uses the FK. For now: NEW writes prefer the FK; reads
-- prefer the FK and fall back to the text.
alter table tasks
  add column if not exists assignee_user_id uuid
    references profiles(id) on delete set null;

create index if not exists tasks_assignee_user_idx
  on tasks (assignee_user_id) where assignee_user_id is not null;

-- gate_last_edited_at — per the user's design choice: the gate
-- answers (gate_what / gate_resources / gate_roles) stay editable
-- on the task forever, but every edit re-stamps this. The §A11
-- mirror surface uses it ("you've edited the gate 3 times — clarity
-- emerging, or the target shifting?") and the §3.5 readout can
-- correlate gate-churn with resolution durability.
alter table tasks
  add column if not exists gate_last_edited_at timestamptz;

-- ─── Task steps (mutable, ordered, completable) ─────────────────

-- The Spawn Engine produces `tasks.spawn_steps` as a jsonb array of
-- strings — the IMMUTABLE original plan, kept as the spawn record.
-- This new table is the MUTABLE working list: each step gets a
-- stable id (so completion events on the chain stay valid across
-- reorders), an order index, body text, and a completed_at flag.
-- Completion is tracked here AND emitted as an event on the chain
-- (events table) so the §3.1 append-only record is intact.

create table if not exists task_steps (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references tasks(id) on delete cascade,
  step_order    int not null,
  body          text not null,
  completed_at  timestamptz,
  completed_by  uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Per-task ordering uniqueness so reorder operations land
  -- predictably (the API swaps two step_order ints in one
  -- transaction). Allows the same order across DIFFERENT tasks.
  constraint task_steps_unique_order_per_task unique (task_id, step_order) deferrable initially deferred
);

create index if not exists task_steps_task_idx
  on task_steps (task_id, step_order);

create index if not exists task_steps_completed_idx
  on task_steps (task_id) where completed_at is not null;

-- RLS on task_steps: same scoping as task_messages — readable to
-- any participant of the task, writable to participants. Mirrors
-- the policies from 0021.
alter table task_steps enable row level security;

drop policy if exists "task_steps - select" on task_steps;
create policy "task_steps - select" on task_steps
  for select using (
    exists (
      select 1
      from task_participants tp
      where tp.task_id = task_steps.task_id
        and tp.user_id = auth.uid()
    )
    or exists (
      select 1
      from tasks t
      join profiles p on p.company_id = t.company_id
      where t.id = task_steps.task_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "task_steps - insert" on task_steps;
create policy "task_steps - insert" on task_steps
  for insert with check (
    exists (
      select 1
      from tasks t
      join profiles p on p.company_id = t.company_id
      where t.id = task_steps.task_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "task_steps - update" on task_steps;
create policy "task_steps - update" on task_steps
  for update using (
    exists (
      select 1
      from tasks t
      join profiles p on p.company_id = t.company_id
      where t.id = task_steps.task_id
        and p.id = auth.uid()
    )
  );

drop policy if exists "task_steps - delete" on task_steps;
create policy "task_steps - delete" on task_steps
  for delete using (
    exists (
      select 1
      from tasks t
      join profiles p on p.company_id = t.company_id
      where t.id = task_steps.task_id
        and p.id = auth.uid()
    )
  );

-- ─── Chain events: step completion ──────────────────────────────

-- Trigger emits events on every completion / re-open so the §3.1
-- chain has the append-only record. The mutable task_steps row is
-- the current state; the events table is the history. §A10
-- compliance: every step-completion event records who did it, so
-- the participant can see their own completion record AND the
-- read is symmetric (admin sees same data the user sees about
-- themselves).
create or replace function emit_task_step_event()
returns trigger
language plpgsql
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from tasks where id = new.task_id;
  if v_company_id is null then return new; end if;

  -- Only fire on completed_at transitions: null→timestamp or
  -- timestamp→null. Edits to body alone don't emit (the body is
  -- editable; the chain cares about completion events).
  if (tg_op = 'UPDATE' and (old.completed_at is null) <> (new.completed_at is null))
     or (tg_op = 'INSERT' and new.completed_at is not null) then
    insert into events (company_id, actor, kind, subject, payload)
    values (
      v_company_id,
      coalesce(new.completed_by, auth.uid()),
      case
        when new.completed_at is not null then 'task.step_completed'
        else 'task.step_reopened'
      end,
      'task:' || new.task_id::text,
      jsonb_build_object(
        'step_id',    new.id,
        'step_order', new.step_order,
        'body',       new.body
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_emit_task_step_event on task_steps;
create trigger trg_emit_task_step_event
  after insert or update on task_steps
  for each row execute function emit_task_step_event();

-- ─── Trigger: stamp gate_last_edited_at on relevant edits ──────

create or replace function stamp_task_gate_edited()
returns trigger
language plpgsql
as $$
begin
  if (new.gate_what     is distinct from old.gate_what)
     or (new.gate_resources is distinct from old.gate_resources)
     or (new.gate_roles is distinct from old.gate_roles) then
    new.gate_last_edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_task_gate_edited on tasks;
create trigger trg_stamp_task_gate_edited
  before update on tasks
  for each row execute function stamp_task_gate_edited();

-- ─── Column documentation ──────────────────────────────────────

comment on column tasks.assignee_user_id is
  'FK on profiles — the assignee proper. The legacy `assignee` text
   column stays during the transition window for backward-compat
   with task rows seeded before the FK existed. New writes prefer
   this column; reads prefer this then fall back to the text.';

comment on column tasks.gate_last_edited_at is
  'When the gate answers (what/resources/roles) were last edited.
   The §A11 mirror surface uses this — repeated edits surface as a
   pattern question ("clarity emerging, or target shifting?"), not
   as a verdict. The §3.5 readout can correlate gate-churn with
   resolution durability.';

comment on table task_steps is
  'Mutable working step list per task. The Spawn Engine seeds this
   from `tasks.spawn_steps` (immutable original plan). Each step
   has a stable id so completion events on the §3.1 chain remain
   valid across reorders. Completion is tracked here AND emitted
   as a chain event by the trigger above. Pillar 1 (Understanding)
   gates whether steps exist; Pillar 2 (Accountability) measures
   their completion; Pillar 3 (Guidance) attaches Coach per-step
   from this row.';

comment on column task_steps.body is
  'Editable. The original spawned text is preserved in
   `tasks.spawn_steps`; this column is what the working participant
   sees and modifies.';

comment on column task_steps.completed_at is
  'When this step was last marked complete. NULL means not
   complete. Transitioning null→timestamp or back fires an event
   on the chain via trg_emit_task_step_event.';
