import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared durability-sweep logic. Two routes call it:
 *   - /api/care/durability-sweep        (POST + shared secret header,
 *     for external cron services / GitHub Actions / etc.)
 *   - /api/care/durability-sweep-cron   (GET + Vercel CRON_SECRET
 *     Bearer auth, for Vercel scheduled functions)
 *
 * Per CLAUDE.md §3.5 — the §3.5 durability loop is the constitutional
 * measurement. The DB trigger schedules a row in
 * support_durability_checks at resolution time. This sweep converts
 * due-but-unchecked rows into agent-visible notification events. The
 * emit function (migration 0050) dedups so re-running is safe.
 *
 * Per CLAUDE.md §A11 — no verdict generation. The sweep fires the
 * event; the agent renders held/reopened/inconclusive via
 * recordDurabilityOutcome.
 */
/** Per-run scan cap. FIFO ordering (below) makes a >cap backlog drain safely over
 *  successive runs; `bounded` in the result surfaces that a backlog exists. */
const DUE_SCAN_LIMIT = 500;

export async function sweepDurabilityChecks(): Promise<{
  ok: true;
  scanned: number;
  emittedAttempts: number;
  sweptAt: string;
  // §3.4 honest-bound (2026-07-09): true when this run hit DUE_SCAN_LIMIT, i.e.
  // there may be MORE due checks than one run processed. FIFO ordering means they
  // are DEFERRED (oldest-first), not lost — but a persistently-true `bounded`
  // signals the run cadence isn't keeping up with due volume (raise frequency or
  // the cap). A silent cap that looked like "all done" is the exact §3.4 failure
  // the sibling dissectBackfill's `scanBounded` flag already avoids.
  bounded: boolean;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("support_durability_checks")
    .select("id")
    // FIFO — oldest-due first (security/correctness 2026-07-09): the query is
    // capped at DUE_SCAN_LIMIT/run, so under a backlog of >cap due checks the
    // UNORDERED default could starve the oldest ones indefinitely (their §3.5
    // consequence measurement would never reach the agent). Ordering by
    // scheduled_for ASC guarantees every due check is eventually processed, oldest
    // first. No policy choice — oldest-due-first is the only correct order here.
    .order("scheduled_for", { ascending: true })
    .is("checked_at", null)
    .lte("scheduled_for", nowIso)
    .limit(DUE_SCAN_LIMIT);
  if (error) {
    throw new Error(error.message);
  }
  const checks = due ?? [];
  const bounded = checks.length >= DUE_SCAN_LIMIT;
  if (bounded) {
    // Operator-visible: a full page means a backlog. Not an error (FIFO drains it
    // next run), but a standing signal the cadence may be under-provisioned.
    // eslint-disable-next-line no-console
    console.warn(
      `[care.durabilitySweep] hit DUE_SCAN_LIMIT=${DUE_SCAN_LIMIT} — a due-check backlog exists; oldest are processed first, remainder deferred to next run.`
    );
  }
  let emitted = 0;
  for (const c of checks) {
    const { error: rpcErr } = await admin.rpc(
      "emit_care_durability_due_event",
      { p_check_id: c.id as string }
    );
    if (!rpcErr) emitted++;
  }
  return {
    ok: true,
    scanned: checks.length,
    emittedAttempts: emitted,
    sweptAt: nowIso,
    bounded,
  };
}
