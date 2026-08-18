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

  // NOTE: the macro pattern summary moved to Today's Metrics (founder spec 2026-08-19). Pitch Performance is now
  // just the recordings list, so this route no longer reads rep_pattern_summaries — one fewer DB read per view.

  // The rep's pitches (name / outcome / status / date + the after-pitch summary snippet) — newest first,
  // bounded. Pitch Performance shows each recording's after-pitch summary inline (founder spec 2026-08-19), so
  // the analysis summary is joined here (left join — a still-processing pitch has none yet).
  const { data: pitchRows, error: pitchErr } = await sb
    .from("pitches")
    .select("id, name, status, recorded_at, door_knocks!inner(outcome), pitch_analyses(summary)")
    .eq("rep_id", repId)
    .order("recorded_at", { ascending: false })
    .limit(200);
  // Surface a read failure honestly — a swallowed error would return 200 with pitches:[] and a rep would think
  // their recordings vanished (error-dressed-as-no-data). The pitch_analyses join enlarged this failure surface.
  if (pitchErr) {
    console.error("[report-card] pitch read failed:", pitchErr); // CWE-209: log detail, return generic
    return NextResponse.json({ error: "Couldn't load your pitches." }, { status: 500 });
  }

  const pitches = (pitchRows ?? []).map((p) => {
    const knock = p.door_knocks as unknown as { outcome: string } | { outcome: string }[];
    const analysis = p.pitch_analyses as unknown as { summary: string } | { summary: string }[] | null;
    const summary = Array.isArray(analysis) ? analysis[0]?.summary : analysis?.summary;
    return {
      id: p.id as string,
      name: p.name as string,
      status: p.status as string,
      recordedAt: p.recorded_at as string,
      outcome: (Array.isArray(knock) ? knock[0]?.outcome : knock?.outcome) ?? "unknown",
      summary: summary ?? null,
    };
  });

  return NextResponse.json({ period, pitches });
}
