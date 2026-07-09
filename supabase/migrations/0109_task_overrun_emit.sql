-- 0109 — emit_task_overran_event(): the missing EMITTER for the dead `task_slipped` signal.
--
-- Why
-- ───
-- signal_sources has registered `('task.overran_due_date','task_slipped', ...)` since 0005:103,
-- but NOTHING ever emits a `task.overran_due_date` event. All task emitters (0006) are
-- TABLE-CHANGE-driven (created / status_changed / reassigned / blocker_recorded); a deadline
-- SLIP is a TIME-based transition — no row changes when a due date passes — so a trigger can't
-- catch it. Result: the core diagnosis product is BLIND to missed deadlines, and `task_slipped`
-- is a dead signal kind (documented gap; §3.5 makes completion TIME a hard metric, so this is a
-- constitutional blind spot, not a nice-to-have). Its sibling `meeting.overran → meeting_overran`
-- stays dead too, but that one needs a `meetings` entity that isn't built — out of scope here.
--
-- Fix (precedent-decided — mirror the §3.5 durability sweep, 0050/0054)
-- ────────────────────────────────────────────────────────────────────
-- A scheduled sweep (src/lib/diagnosis/taskOverrunSweep.ts) finds overdue-and-open tasks and
-- calls this SECURITY DEFINER emit function per task. Structure mirrors emit_care_durability_due_event
-- (0054): definer + pinned search_path, dedup on an existing event, actor = null (0054's fix — a
-- system-emitted event has no human actor; null is FK-safe and satisfies 0103's WITH CHECK). The
-- emitted event flows through derive_signals_for_event → a `task_slipped` signal sourced at the
-- task, so §1.2 retrospective analysis finally sees deadline slips.
--
-- Idempotent at TWO levels: (1) this function dedups, so a task that already has a
-- `task.overran_due_date` event is never double-emitted no matter how many times the sweep runs
-- while the task stays overdue; (2) §A12 create-or-replace. Definer bypasses RLS + the events
-- append-only rules apply to direct writes, not this insert. STATUS: code-ready; NOT live until the
-- operator wires the cron (see the route) — the durability-sweep posture, and the founder's
-- build/defer call on go-live (closure-doc item 9).

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
  -- Only open tasks past their due date qualify. Re-checked here (not just in the
  -- sweep query) so a direct/again call can't emit a slip for a completed or
  -- not-yet-due task.
  if v_task.due_date is null
     or v_task.due_date >= current_date
     or v_task.status = 'Completed' then
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

  -- CRITICAL: events do NOT auto-derive signals — there is no trigger on the
  -- events table. Every emitter explicitly derives (0006 task emitters, 0012 chat
  -- emitters all `perform derive_signals_for_event`). Without this call the event
  -- is emitted but the `task_slipped` signal (signal_sources 0005:103) never
  -- materializes — the whole point of the sweep. (The durability emitter omits
  -- this only because its notification event has NO signal_source; ours does.)
  perform derive_signals_for_event(v_event_id);
end;
$$;

-- run_task_overrun_sweep(p_limit) — the batch entry point the scheduled sweep calls.
--
-- Why a SQL batch fn and not a TS query + per-row RPC (the durability shape): the durability
-- sweep excludes already-processed rows via `checked_at is null`, so its per-run cap can't be
-- starved by a backlog. tasks have NO such column — a naive "all overdue-open tasks" query would
-- keep returning tasks that ALREADY have a slip event, and under a >cap backlog the cap would be
-- permanently consumed by ancient already-emitted tasks, starving newly-overdue ones (their slip
-- would never emit). The `NOT EXISTS (a slip event)` filter — which PostgREST can't express — is
-- the fix, so candidate selection lives here in SQL. FIFO (due_date asc) drains any backlog
-- oldest-first. Returns how many NEW slip events were emitted this run.
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
      and t.status <> 'Completed'
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
