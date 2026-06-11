-- 0023 — task.participant_added chain emission
--
-- Closes the notification-source gap noted in commit f9e814c:
-- Notifications Phase 2 added decision.opened / decision.decided to
-- the inbox but deferred "you were added to a task" because the
-- legacy `tasks.assignee` column is free text, not a user_id, and
-- faking a notification source was the wrong move.
--
-- This migration emits the right shape from the right surface: a
-- trigger on task_participants insert that fires a
-- `task.participant_added` event into the §3.1 chain with
-- (task_id, added_user_id, role, task_title) in the payload. The
-- /api/notifications route then filters where
-- payload.added_user_id == caller AND actor != caller — same shape
-- as the decision.* filtering in Phase 2.
--
-- Self-add is skipped: when a task creator inserts themselves as the
-- owner participant, no notification fires. You don't notify yourself
-- for things you just did. (Same A11-adjacent discipline applied at
-- the source rather than the consumer — cheaper for the runtime.)
--
-- A12 (migration safe-to-re-run): every object below uses CREATE OR
-- REPLACE FUNCTION / DROP TRIGGER IF EXISTS / CREATE TRIGGER. No
-- naked DROP / CREATE in this migration.

-- ─────────────────────────────────────────────────────────────
-- Function: emit task.participant_added on insert.
-- SECURITY INVOKER so auth.uid() returns the calling user's id —
-- that becomes the event actor. For service-role inserts (rare;
-- this surface is normally called from the API layer), auth.uid()
-- is null and the event still lands with actor=null, which the
-- notification copy handles ("You were added to {task title}" with
-- no actor name).
-- ─────────────────────────────────────────────────────────────

create or replace function task_participant_added_emit_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_actor      uuid := auth.uid();
  v_company_id uuid;
  v_task_title text;
begin
  -- Skip self-adds. The owner adding themselves on task creation is
  -- not a notification-worthy event; treating it as one would flood
  -- the inbox with rows the user just caused.
  if v_actor is not null and v_actor = NEW.user_id then
    return NEW;
  end if;

  -- Look up the task's company + title in one shot. If the task
  -- somehow doesn't exist (FK should prevent this, but defensively),
  -- skip emission rather than crash the participant insert.
  select t.company_id, t.title
    into v_company_id, v_task_title
    from tasks t
   where t.id = NEW.task_id;
  if v_company_id is null then
    return NEW;
  end if;

  insert into events (company_id, kind, subject, actor, payload, occurred_at)
  values (
    v_company_id,
    'task.participant_added',
    'task:' || NEW.task_id::text,
    v_actor,
    jsonb_build_object(
      'task_id',        NEW.task_id,
      'added_user_id',  NEW.user_id,
      'role',           NEW.role,
      'task_title',     v_task_title
    ),
    NEW.joined_at
  );
  return NEW;
end;
$$;

drop trigger if exists task_participant_added_emit_event_trigger
  on task_participants;
create trigger task_participant_added_emit_event_trigger
  after insert on task_participants
  for each row execute function task_participant_added_emit_event();
