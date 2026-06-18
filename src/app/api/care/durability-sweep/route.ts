import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/care/durability-sweep
 *
 * Periodic sweep that converts due-but-unchecked durability rows into
 * notification events via emit_care_durability_due_event (migration
 * 0050). Idempotent — the SQL function dedups against the events
 * table.
 *
 * Auth: gated by a shared CARE_DURABILITY_SWEEP_SECRET env header so
 * a cron job (Vercel cron / GitHub Action / external pinger) can run
 * it without holding a user session. Not user-facing.
 *
 * Per CLAUDE.md §3.5 — the loop has to actually fire. The trigger
 * inserts the durability check at resolution time; this route is the
 * thing that fires the "you have a re-review due" notification. The
 * agent reads it. The §3.5 measurement gets recorded.
 *
 * Per CLAUDE.md §A11 — no verdict generation here. The route only
 * fires the event; the agent renders the held/reopened/inconclusive
 * verdict via recordDurabilityOutcome.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CARE_DURABILITY_SWEEP_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "CARE_DURABILITY_SWEEP_SECRET is not set. Sweep is disabled until an operator configures the shared secret.",
      },
      { status: 503 }
    );
  }
  const provided = req.headers.get("x-care-sweep-secret");
  if (provided !== expected) {
    return NextResponse.json(
      { error: "Sweep authentication failed." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  // Pull every durability check that's due AND unchecked. The SQL
  // function dedups against events, so re-running this is safe.
  const { data: due, error } = await admin
    .from("support_durability_checks")
    .select("id")
    .is("checked_at", null)
    .lte("scheduled_for", nowIso)
    .limit(500);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  return NextResponse.json({
    ok: true,
    scanned: checks.length,
    emittedAttempts: emitted,
    sweptAt: nowIso,
  });
}
