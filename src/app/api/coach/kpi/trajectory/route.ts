import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { MIN_MONTHS_FOR_TRAJECTORY, buildTrajectory, type TrajectorySnapshotRow } from "@/lib/coach/kpi/trajectory";

/**
 * GET /api/coach/kpi/trajectory — the caller's OWN month-over-month KPI trajectory (§3.6 "make learning
 * visible"). Reads the IMMUTABLE monthly snapshots the compute-cron freezes into kpi_snapshot (period =
 * 'YYYY-MM'), NOT the live 'current' rollup, so the series is a real longitudinal record rather than a
 * recomputed instant. Self-scoped (`agent_id = ctx.userId`) even though RLS also permits a manager read —
 * this endpoint is the rep's own growth curve; the manager rollup is /team's concern.
 *
 * §3.4 honesty: a trajectory needs ≥ MIN_MONTHS_FOR_TRAJECTORY months to mean anything. With fewer, the
 * response says `building: true` and the UI shows "your trajectory appears as months accumulate" instead of
 * drawing a fake trend from one point. The reader returns the raw per-metric series; the delta/sparkline
 * framing is the UI's job.
 */
export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Monthly snapshots only (period != 'current'). The two period kinds the cron writes are 'current'
  // (overwritten each run) and 'YYYY-MM' (frozen once the month rolls over) — so excluding 'current' leaves
  // exactly the longitudinal series. Self-pinned + RLS-bound (createClient, not the admin client).
  const { data, error } = await sb
    .from("kpi_snapshot")
    .select("metric, layer, value, period, sample_size")
    .eq("agent_id", ctx.userId)
    .neq("period", "current")
    .order("period", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Couldn't load your trajectory." }, { status: 500 });
  }

  const rows: TrajectorySnapshotRow[] = (data ?? []).map((r) => ({
    metric: r.metric as string,
    layer: r.layer as number,
    value: r.value === null || r.value === undefined ? null : Number(r.value),
    period: r.period as string,
    sampleSize: (r.sample_size as number | null) ?? 0,
  }));

  return NextResponse.json(buildTrajectory(rows));
}
