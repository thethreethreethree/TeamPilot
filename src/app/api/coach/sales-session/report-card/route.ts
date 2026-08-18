import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/coach/sales-session/report-card?period=day|week|month|all_time
 *
 * The Report Card (Macro Mode Tab 2): the rep's latest macro pattern summary for the period + their pitch
 * list. RLS-scoped — a rep sees only their own; a manager sees the team's (rep+manager, Q4). Read-only,
 * no LLM cost (the summaries are precomputed by the rollup worker).
 */
const PERIODS = ["day", "week", "month", "all_time"] as const;

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const periodParam = req.nextUrl.searchParams.get("period") ?? "week";
  const period = (PERIODS as readonly string[]).includes(periodParam) ? periodParam : "week";

  // F6: filter by a SPECIFIC rep — default to the caller (so a rep sees their OWN, and a manager doesn't
  // get an arbitrary team member's summary under rep+manager RLS). A manager may pass ?repId=<team member>;
  // RLS still authorizes (a non-manager passing someone else's id gets 0 rows).
  const repId = req.nextUrl.searchParams.get("repId") ?? auth.user.id;

  // Latest summary for this period + rep (the rollup worker upserts per period_start; newest generated wins).
  const { data: summaryRow } = await sb
    .from("rep_pattern_summaries")
    .select("headline, patterns_good, patterns_bad, trend, pitch_count, generated_at")
    .eq("period", period)
    .eq("rep_id", repId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The rep's pitches (name / outcome / status / date) — newest first, bounded.
  const { data: pitchRows } = await sb
    .from("pitches")
    .select("id, name, status, recorded_at, door_knocks!inner(outcome)")
    .eq("rep_id", repId)
    .order("recorded_at", { ascending: false })
    .limit(200);

  const pitches = (pitchRows ?? []).map((p) => {
    const knock = p.door_knocks as unknown as { outcome: string } | { outcome: string }[];
    return {
      id: p.id as string,
      name: p.name as string,
      status: p.status as string,
      recordedAt: p.recorded_at as string,
      outcome: (Array.isArray(knock) ? knock[0]?.outcome : knock?.outcome) ?? "unknown",
    };
  });

  return NextResponse.json({
    period,
    summary: summaryRow
      ? {
          headline: summaryRow.headline as string,
          patternsGood: (summaryRow.patterns_good as string[]) ?? [],
          patternsBad: (summaryRow.patterns_bad as string[]) ?? [],
          trend: summaryRow.trend as { direction?: string; note?: string } | null,
          pitchCount: (summaryRow.pitch_count as number) ?? 0,
        }
      : null,
    pitches,
  });
}
