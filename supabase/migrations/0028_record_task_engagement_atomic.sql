-- 0028 — Atomic task engagement increment
--
-- Closes §1.7 audit finding M4 (2026-06-12).
--
-- The audit identified that recordEngagement() in src/lib/data/tasks.ts
-- increments task_participants.engagement_count with a read-then-write:
--
--   SELECT engagement_count FROM task_participants WHERE ...   -- read
--   UPSERT engagement_count = (read_value) + 1                 -- write
--
-- Two concurrent calls observing the same pre-value both write
-- pre+1; one increment is lost. Worse — for first-time engagement
-- (no existing row), two concurrent calls each read NULL, each write
-- engagement_count=1, the UPSERT's ON CONFLICT collapses them, and
-- the count is 1 instead of 2. Every lost increment silently
-- understates the Pillar 2 "meaningful action" signal — the same
-- signal the §4 readout uses to test whether participant engagement
-- predicts task completion (per signal_sources.notes on
-- task.participant_added, 0026).
--
-- Fix: a SECURITY INVOKER plpgsql function performs the increment
-- inside a single statement using ON CONFLICT DO UPDATE referencing
-- the EXCLUDED + the existing row. Atomic at the row level by
-- construction — Postgres' on-conflict path holds the row lock,
-- so the second concurrent write reads the post-first-update value
-- and increments from there. No lost increments under any
-- concurrency.
--
-- SECURITY INVOKER keeps caller auth (auth.uid()), so RLS still
-- applies to the INSERT and UPDATE branches — no privilege
-- elevation.
--
-- A12 discipline: CREATE OR REPLACE FUNCTION is idempotent.

create or replace function record_task_engagement(
  p_task_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Single-statement atomic upsert. The ON CONFLICT path is the
  -- load-bearing piece: Postgres acquires the row lock when the
  -- INSERT would collide, then evaluates the UPDATE expression
  -- against the LOCKED row's current value. Concurrent callers
  -- serialize through the lock — no lost increments.
  insert into task_participants (
    task_id, user_id, role, last_engaged_at, engagement_count
  )
  values (
    p_task_id, v_actor, 'member', now(), 1
  )
  on conflict (task_id, user_id) do update
    set last_engaged_at  = excluded.last_engaged_at,
        engagement_count = task_participants.engagement_count + 1;
end;
$$;

comment on function record_task_engagement(uuid) is
  'Atomic engagement increment on task_participants. Closes audit
   M4 (2026-06-12). Single-statement INSERT ... ON CONFLICT DO
   UPDATE with engagement_count = task_participants.engagement_count
   + 1 — row-locked by the on-conflict path, so concurrent calls
   serialize and no increments are lost. Used by the recordEngagement
   client helper. SECURITY INVOKER preserves RLS per write.';
