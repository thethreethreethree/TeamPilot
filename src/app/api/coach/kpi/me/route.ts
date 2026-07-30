import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import {
  conversionRate,
  closeRate,
  revenue,
  avgDealSize,
  sessionsPerDay,
  avgSessionDurationMin,
  MIN_SESSIONS,
  type KpiSessionRow,
  type MetricResult,
} from "@/lib/coach/kpi/compute";

/**
 * GET /api/coach/kpi/me — the caller's OWN KPI snapshot, computed on-read (founder: on-read + cron).
 *
 * Computes live from the caller's coaching_sessions (RLS-scoped to their own rows). No DB write on read —
 * always fresh, can't sit dormant. The cron path persists snapshots for team rollup + digests. Every metric
 * carries the Understanding Gate ("building" until MIN_SESSIONS) + its sourceSessionIds for drill-down, so
 * nothing here asserts a number it can't trace to real sessions.
 */
export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // The caller's own sessions (agent_id = self). RLS also permits same-company reads, so pin to self.
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("id, outcome, deal_value, started_at, ended_at")
    .eq("agent_id", ctx.userId)
    .order("started_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Couldn't load your sessions." }, { status: 500 });
  }

  const rows: KpiSessionRow[] = (data ?? []).map((r) => ({
    sessionId: r.id as string,
    outcome: (r.outcome as KpiSessionRow["outcome"]) ?? null,
    dealValue:
      r.deal_value === null || r.deal_value === undefined ? null : Number(r.deal_value),
    startedAt: r.started_at as string,
    endedAt: (r.ended_at as string | null) ?? null,
  }));

  const metrics: Record<string, MetricResult> = {
    conversionRate: conversionRate(rows),
    closeRate: closeRate(rows),
    revenue: revenue(rows),
    avgDealSize: avgDealSize(rows),
    sessionsPerDay: sessionsPerDay(rows),
    avgSessionDurationMin: avgSessionDurationMin(rows),
  };

  return NextResponse.json({
    sessionCount: rows.length,
    minSessions: MIN_SESSIONS,
    metrics,
  });
}
