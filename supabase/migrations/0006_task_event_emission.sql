-- 0006 — Task mutations emit events
--
-- Wires the existing `tasks` table into the §3.1 chain. Every task lifecycle
-- mutation now emits an immutable event into the events table, which in turn
-- runs through derive_signals_for_event() to produce signals.
--
-- This is the production data source. Without this trigger, the tasks table is
-- isolated state that never feeds the diagnostic chain — the entire Living
-- Diagnosis runtime operates over nothing.
--
-- This does NOT refactor tasks into a pure projection (that requires an
-- amendment per §7). The table remains the materialized state; the trigger is
-- a sidecar that ALSO writes events so the chain runs end-to-end.

-- ─────────────────────────────────────────────────────────────
-- Helper: lookup signal_sources at insert time without the trigger function
-- having to re-implement template rendering. The existing
-- derive_signals_for_event() function already does this — we just need to call
-- it after we record the event.
-- ─────────────────────────────────────────────────────────────

create or replace function tasks_emit_events()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  if TG_OP = 'INSERT' then
    -- task.created
    v_event_id := record_event(
      'task.created',
      'task:' || NEW.id::text,
      jsonb_build_object(
        'task_id', NEW.id,
        'title', NEW.title,
        'department', NEW.department,
        'assignee', NEW.assignee,
        'status', NEW.status,
        'priority', NEW.priority,
        'due_date', NEW.due_date
      )
    );
    perform derive_signals_for_event(v_event_id);
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    -- Status change is the most operationally meaningful signal source.
    if OLD.status is distinct from NEW.status then
      v_event_id := record_event(
        'task.status_changed',
        'task:' || NEW.id::text,
        jsonb_build_object(
          'task_id', NEW.id,
          'from', OLD.status,
          'to', NEW.status,
          'title', NEW.title
        )
      );
      perform derive_signals_for_event(v_event_id);
    end if;

    if OLD.priority is distinct from NEW.priority then
      v_event_id := record_event(
        'task.priority_changed',
        'task:' || NEW.id::text,
        jsonb_build_object(
          'task_id', NEW.id,
          'from', OLD.priority,
          'to', NEW.priority
        )
      );
      perform derive_signals_for_event(v_event_id);
    end if;

    if OLD.assignee is distinct from NEW.assignee then
      v_event_id := record_event(
        'task.reassigned',
        'task:' || NEW.id::text,
        jsonb_build_object(
          'task_id', NEW.id,
          'from', OLD.assignee,
          'to', NEW.assignee
        )
      );
      perform derive_signals_for_event(v_event_id);
    end if;

    if OLD.blocker_reason is distinct from NEW.blocker_reason
       and NEW.blocker_reason is not null then
      v_event_id := record_event(
        'task.blocker_recorded',
        'task:' || NEW.id::text,
        jsonb_build_object(
          'task_id', NEW.id,
          'reason', NEW.blocker_reason
        )
      );
      perform derive_signals_for_event(v_event_id);
    end if;

    return NEW;
  end if;

  return NULL;
end;
$$;

drop trigger if exists tasks_emit_events_trigger on tasks;
create trigger tasks_emit_events_trigger
  after insert or update on tasks
  for each row execute function tasks_emit_events();

-- ─────────────────────────────────────────────────────────────
-- Additional signal_source rules now that we know the kinds we emit
-- ─────────────────────────────────────────────────────────────

insert into signal_sources (event_kind, signal_kind, source_template, notes) values
  ('task.reassigned', 'task_reassigned', 'task:${payload.task_id}',
   'A task being moved between assignees indicates ownership uncertainty or workload rebalancing.'),
  ('task.blocker_recorded', 'task_blocked', 'task:${payload.task_id}',
   'An explicit blocker entry is a strong signal that something is stuck.'),
  ('task.priority_changed', 'priority_escalation', 'task:${payload.task_id}',
   'A priority change (especially escalation) signals shifting urgency.')
on conflict (event_kind, signal_kind) do nothing;

-- ─────────────────────────────────────────────────────────────
-- soft_delete: tasks have a deleted_at column added so deletion is an event,
-- not a hole in the record. Per §3.1, the historical record is preserved.
-- ─────────────────────────────────────────────────────────────

alter table tasks add column if not exists deleted_at timestamptz;

-- A soft delete is just an UPDATE setting deleted_at — we emit an event for it.
create or replace function tasks_emit_soft_delete_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  if OLD.deleted_at is null and NEW.deleted_at is not null then
    v_event_id := record_event(
      'task.deleted',
      'task:' || NEW.id::text,
      jsonb_build_object('task_id', NEW.id, 'title', NEW.title)
    );
    perform derive_signals_for_event(v_event_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists tasks_soft_delete_trigger on tasks;
create trigger tasks_soft_delete_trigger
  after update on tasks
  for each row execute function tasks_emit_soft_delete_event();
