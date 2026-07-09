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
export async function sweepDurabilityChecks(): Promise<{
  ok: true;
  scanned: number;
  emittedAttempts: number;
  sweptAt: string;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("support_durability_checks")
    .select("id")
    // FIFO — oldest-due first (security/correctness 2026-07-09): the query is
    // capped at 500/run, so under a backlog of >500 due checks the UNORDERED
    // default could starve the oldest ones indefinitely (their §3.5 consequence
    // measurement would never reach the agent). Ordering by scheduled_for ASC
    // guarantees every due check is eventually processed, oldest first. No policy
    // choice — oldest-due-first is the only correct order for a due-queue sweep.
    .order("scheduled_for", { ascending: true })
    .is("checked_at", null)
    .lte("scheduled_for", nowIso)
    .limit(500);
  if (error) {
    throw new Error(error.message);
  }
  const checks = due ?? [];
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
  };
}
