import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodaysMetrics } from "@/lib/data/doorlog";
import { isMetricsPeriod } from "@/lib/coach/doorlog/period";

/**
 * GET /api/coach/sales-session/todays-metrics?period=day|week|month|all_time
 *
 * Today's Metrics (Macro Mode, founder spec 2026-08-19): the KPI trio, the Score-Chart averages, the Next-Door
 * focus + growth opportunities for the period. RLS-scoped — a rep sees their own; a manager may pass ?repId=.
 * Read-only, no LLM cost (the rollup summaries are precomputed).
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const periodParam = req.nextUrl.searchParams.get("period") ?? "day";
  const period = isMetricsPeriod(periodParam) ? periodParam : "day";
  // Default to the caller (a rep sees their OWN); a manager may pass a team member's id, still RLS-authorized.
  const repId = req.nextUrl.searchParams.get("repId") ?? auth.user.id;

  // getTodaysMetrics → fetchAllPaged throws on a read error. In prod Next returns a generic 500 (no leak) and the
  // client's res.ok check shows the honest error banner — but wrap it for controlled logging + a stable shape.
  try {
    const metrics = await getTodaysMetrics(repId, period);
    return NextResponse.json({ period, ...metrics });
  } catch (e) {
    console.error("[todays-metrics] load failed:", e); // CWE-209: log detail, return generic
    return NextResponse.json({ error: "Couldn't load your metrics." }, { status: 500 });
  }
}
