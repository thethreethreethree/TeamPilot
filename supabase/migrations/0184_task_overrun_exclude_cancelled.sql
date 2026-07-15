-- 0184 — task-overrun sweep must exclude CANCELLED tasks, not just Completed.
--
-- Diagnosis (§2 diagnose-before-patch; §A25 false-match-worse-than-miss; §3.5)
-- ─────────────────────────────────────────────────────────────────────────────
-- 0109 introduced the task-overrun sweep — the emitter for the previously-dead
-- `task_slipped` signal. Both its functions decide "is this task still open?" with
-- `status <> 'Completed'` (candidate query) and `status = 'Completed'` (emit re-check).
--
-- But 'Completed' is NOT the only TERMINAL task status. The server-side transition
-- graph in src/app/api/tasks/route.ts (lines 214-219) is:
--     New:          [In Progress, Blocked, Cancelled]
--     In Progress:  [Blocked, Completed, Cancelled]
--     Blocked:      [In Progress, Cancelled]
--     Completed:    []                    ← terminal
--     Cancelled:    []                    ← terminal, and NOT excluded by 0109
-- 'Cancelled' is reachable: the PATCH route validates status ONLY against this map
-- (it does not run the TaskCreateSchema enum, which omits 'Cancelled'), so a direct
-- API/mobile consumer can drive In Progress → Cancelled. tasks.status is free `text`
-- with no CHECK, so nothing at the DB layer prevents it either.
--
-- Consequence: an overdue task that was DELIBERATELY CANCELLED passes 0109's filter,
-- emits a `task.overran_due_date` event, and derives a `task_slipped` signal into the
-- append-only §3.1 chain. That is a FALSE missed-deadline for work someone consciously
-- closed — §A25 (a false match is worse than a miss) polluting a §3.5 HARD metric
-- (completion time) with noise that §1.2 retrospective analysis would then reason from.
-- A slip signal is durable and immutable; unlike a transient UI badge it cannot be
-- walked back, which is why this is the highest-consequence instance of the class.
--
-- Reachable-but-not-yet-fired: the sweep cron is dormant (503 until CRON_SECRET is
-- set), so NO slip has been emitted yet. This fix lands BEFORE first emission — there
-- is no historical false-slip to clean up.
--
-- Fix (§A26 — a bug is a class; fix to the boundary)
-- ─────────────────────────────────────────────────────────────────────────────
-- Exclude BOTH terminal statuses in BOTH functions. `not in ('Completed','Cancelled')`
-- is the open-task predicate; if a future terminal status is added, extend this list
-- (and reconcile the transition map). create-or-replace only — 0109 is applied, so its
-- file is immutable (§7.3 append-only / migration discipline); this supersedes it.
--
-- NOT fixed here (flagged for founder decision, same Cancelled-blindness class but
-- lower consequence — transient, not a durable signal):
--   • admin/team-check/nudge + team-check candidate filter (`status === 'Completed'`)
--     would nudge on a cancelled task.
--   • operations staleness badge (`status !== 'Completed'`) flags a cancelled task stale.
-- And a separate inconsistency worth resolving: the server transition map allows
-- 'Cancelled' while the create enum (validate.ts) and the web-UI map omit it.

-- Emit re-check guard: reject Completed OR Cancelled (was: Completed only).
create or replace function emit_task_overran_event(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task     tasks%rowtype;
  v_event_id uuid;
begin
  select * into v_task from tasks where id = p_task_id;
  if v_task.id is null then
    return;
  end if;
  -- Only OPEN tasks past their due date qualify. Completed AND Cancelled are both
  -- terminal (closed business) — a cancelled task did not slip, it was deliberately
  -- ended. Re-checked here (not just in the sweep query) so a direct/again call can't
  -- emit a slip for a closed or not-yet-due task.
  if v_task.due_date is null
     or v_task.due_date >= current_date
     or v_task.status in ('Completed', 'Cancelled') then
    return;
  end if;

  -- Dedup: one slip event per task. The task stays overdue every day; without
  -- this the sweep would emit a fresh slip on every run.
  if exists (
    select 1 from events e
    where e.kind = 'task.overran_due_date'
      and e.subject = 'task:' || v_task.id::text
  ) then
    return;
  end if;

  insert into events (company_id, actor, kind, subject, payload, occurred_at)
  values (
    v_task.company_id,
    null,
    'task.overran_due_date',
    'task:' || v_task.id::text,
    jsonb_build_object(
      'task_id', v_task.id,
      'due_date', v_task.due_date,
      'days_overdue', (current_date - v_task.due_date)
    ),
    now()
  )
  returning id into v_event_id;

  -- CRITICAL: events do NOT auto-derive signals — every emitter derives explicitly.
  -- Without this the event exists but the `task_slipped` signal never materializes.
  perform derive_signals_for_event(v_event_id);
end;
$$;

-- Batch candidate query: exclude Completed OR Cancelled (was: Completed only).
create or replace function run_task_overrun_sweep(p_limit int default 500)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_before  bigint;
  v_after   bigint;
  v_emitted int := 0;
begin
  for v_id in
    select t.id
    from tasks t
    where t.due_date is not null
      and t.due_date < current_date
      and t.status not in ('Completed', 'Cancelled')   -- was: <> 'Completed'
      and not exists (
        select 1 from events e
        where e.kind = 'task.overran_due_date'
          and e.subject = 'task:' || t.id::text
      )
    order by t.due_date asc
    limit greatest(p_limit, 1)
  loop
    select count(*) into v_before from events
      where kind = 'task.overran_due_date' and subject = 'task:' || v_id::text;
    perform emit_task_overran_event(v_id);
    select count(*) into v_after from events
      where kind = 'task.overran_due_date' and subject = 'task:' || v_id::text;
    if v_after > v_before then
      v_emitted := v_emitted + 1;
    end if;
  end loop;
  return v_emitted;
end;
$$;
