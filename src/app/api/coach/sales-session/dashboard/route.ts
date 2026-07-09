import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCueRelianceSeries } from "@/lib/data/salesCoach";

/**
 * GET /api/coach/sales-session/dashboard
 *
 * Aggregates the CURRENT agent's own sales-coaching data for the Sales
 * Coach home (§3.6 make-learning-visible; §A18 digital-gym — measured
 * against your OWN past, never ranked against others). RLS-scoped, so an
 * agent only ever sees their own.
 *
 * Honest by construction (§3.4): every number is derived from real
 * sessions / cues / reviews. With no activity yet, the numbers are zero
 * — the empty state is the truth, not a bug.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const agentId = auth.user.id;

  const { data: sessionsData, error: eSessions } = await supabase
    .from("coaching_sessions")
    .select("id, status, started_at")
    .eq("agent_id", agentId);
  const sessions = sessionsData ?? [];

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsTotal = sessions.length;
  const sessionsThisWeek = sessions.filter(
    (s) => new Date(s.started_at as string).getTime() >= weekAgo
  ).length;
  const activeCount = sessions.filter((s) => s.status === "active").length;
  const reviewedCount = sessions.filter((s) => s.status === "reviewed").length;
  const awaitingReview = sessions.filter((s) => s.status === "ended").length;

  // Total cues delivered across the agent's sessions.
  let cuesTotal = 0;
  const ids = sessions.map((s) => s.id as string);
  if (ids.length > 0) {
    const { count } = await supabase
      .from("coaching_cues")
      .select("id", { count: "exact", head: true })
      .in("session_id", ids);
    cuesTotal = count ?? 0;
  }

  // Reviews generated + recent growth opportunities (real text, not
  // clustered "themes" we'd be inventing).
  const { data: reviewEvents, error: eReviews } = await supabase
    .from("events")
    .select("payload, created_at")
    .eq("actor", agentId)
    .eq("kind", "coach.sales_review_generated")
    .order("created_at", { ascending: false })
    .limit(50);
  const reviews = reviewEvents ?? [];
  const reviewsGenerated = reviews.length;
  const recentGrowth: string[] = [];
  for (const e of reviews) {
    const ga = (e.payload as Record<string, unknown> | null)?.growth_areas;
    if (Array.isArray(ga)) {
      for (const g of ga) {
        const opp = (g as Record<string, unknown>)?.opportunity;
        if (typeof opp === "string" && opp.trim()) recentGrowth.push(opp.trim());
      }
    }
  }

  // §3.4 honest-error-state (audit 2026-07-09): sessionsData drives EVERY stat —
  // if it (or the reviews read) failed, don't return all-zeros as if the rep had
  // no activity. Return 500 so the sessions page (which sets stats only on res.ok,
  // and hides the stat cards when stats is null) shows nothing rather than a
  // misleading empty readout. Happy path unchanged (fires only on a real error).
  if (eSessions || eReviews) {
    return NextResponse.json(
      { error: (eSessions ?? eReviews)!.message },
      { status: 500 }
    );
  }

  // Cue-reliance trend (§3.5 "training wheels come off").
  const series = await getCueRelianceSeries(agentId);

  return NextResponse.json({
    stats: {
      sessionsTotal,
      sessionsThisWeek,
      activeCount,
      awaitingReview,
      reviewedCount,
      cuesTotal,
      reviewsGenerated,
      recentGrowth: recentGrowth.slice(0, 5),
    },
    series,
  });
}
