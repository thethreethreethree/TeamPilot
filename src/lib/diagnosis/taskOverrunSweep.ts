import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Task-overrun sweep — the EMITTER for the `task_slipped` signal (closure-doc
 * item 9). Two routes call it:
 *   - POST /api/diagnosis/task-overrun-sweep        (shared-secret header, for
 *     external cron / GitHub Actions)
 *   - GET  /api/diagnosis/task-overrun-sweep-cron   (Vercel CRON_SECRET Bearer)
 *
 * Per CLAUDE.md §3.5 — completion TIME is a hard metric, so a missed deadline is
 * core diagnostic signal. signal_sources has mapped `task.overran_due_date →
 * task_slipped` since 0005, but nothing emitted it (all task emitters are
 * table-change triggers; a deadline slip is a TIME transition no trigger sees).
 * This sweep closes that: it calls run_task_overrun_sweep (0109), which finds
 * overdue-and-open tasks WITHOUT an existing slip event and emits one each →
 * derive_signals_for_event materializes a `task_slipped` signal at the task.
 *
 * The batch logic is in SQL (0109) — deliberately, not in TS — because the
 * candidate set must exclude already-emitted tasks via NOT EXISTS (PostgREST
 * can't express it), without which a >cap backlog would starve newly-overdue
 * tasks. This wrapper stays thin so it's trivially unit-testable.
 *
 * Idempotent: the emit function dedups, so re-running never double-counts a slip.
 * NOT live until the operator wires the cron (schedule + CRON_SECRET) — the
 * durability-sweep posture; go-live is the founder's build/defer call (item 9).
 */
const OVERRUN_SCAN_LIMIT = 500;

export async function sweepTaskOverruns(): Promise<{
  ok: true;
  emitted: number;
  sweptAt: string;
  // §3.4 honest-bound: true when this run emitted a full page, i.e. there may be
  // MORE overdue tasks than one run processed. FIFO (oldest-due-first, in the SQL
  // fn) means they are DEFERRED, not lost — but a persistently-true `bounded`
  // means the cadence isn't keeping up (raise frequency or the cap).
  bounded: boolean;
}> {
  const admin = createAdminClient();
  const sweptAt = new Date().toISOString();

  const { data, error } = await admin.rpc("run_task_overrun_sweep", {
    p_limit: OVERRUN_SCAN_LIMIT,
  });
  if (error) {
    throw new Error(error.message);
  }
  const emitted = typeof data === "number" ? data : 0;
  const bounded = emitted >= OVERRUN_SCAN_LIMIT;
  if (bounded) {
    // eslint-disable-next-line no-console
    console.warn(
      `[diagnosis.taskOverrunSweep] hit OVERRUN_SCAN_LIMIT=${OVERRUN_SCAN_LIMIT} — a deadline-slip backlog exists; oldest processed first, remainder deferred to next run.`
    );
  }
  return { ok: true, emitted, sweptAt, bounded };
}
