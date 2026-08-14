import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCueRelianceSeries } from "@/lib/data/salesCoach";
import { fetchAllPaged } from "@/lib/supabase/paginate";

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

  // Paged (was an unbounded .select capped at 1000): sessionsTotal + the pipeline counts + cue-total are
  // derived from this set in JS, so a rep past 1000 lifetime sessions had every dashboard stat silently capped
  // (truncation-class fix, founder-authorized 2026-08-12). Stable uuid `id` order → range paging reads each row
  // once. fetchAllPaged throws on a read error → the §3.4 fail-loud below (a failed read must not read as zero
  // activity). (Residual: a rep past ~1000 SESSIONS makes the cue-count `.in(session_id, ids)` list itself a
  // >1000 filter — the same rarer concern flagged on the KPI fix; a server-side aggregate is the fix there.)
  const sessionsData = await fetchAllPaged<{ id: string; status: string; started_at: string }>(
    (from, to) =>
      supabase
        .from("coaching_sessions")
        .select("id, status, started_at")
        .eq("agent_id", agentId)
        .order("id")
        .range(from, to),
    { label: "dashboard sessions" },
  ).catch(() => null);
  const sessions = sessionsData ?? [];

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsTotal = sessions.length;
  const sessionsThisWeek = sessions.filter(
    (s) => new Date(s.started_at as string).getTime() >= weekAgo
  ).length;
  const activeCount = sessions.filter((s) => s.status === "active").length;

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

  // Reviews are identified by the DURABLE coach.sales_review_generated EVENT (subject = sales_session:<id>),
  // NOT session.status='reviewed' — which NO code path ever writes (2026-08-14 finding: "Reviewed" was
  // permanently 0, "Awaiting review" never drained, the Sessions "Reviewed" filter was always empty). This is
  // the same signal the list route already uses for its `hasReview` badge. Paged (was `.limit(50)`) so the count
  // is UNCAPPED and keyed on DISTINCT sessions — a rep who REGENERATED a review can no longer show reviews >
  // sessions (2026-08-14 finding). Filtered by `actor` only (an agent's review events are all their own
  // sessions), so no >1000-subject `.in` filter. Throws → caught to null → the honest fail-loud below.
  const reviewEventsAll = await fetchAllPaged<{
    subject: string;
    payload: Record<string, unknown> | null;
    created_at: string;
  }>(
    (from, to) =>
      supabase
        .from("events")
        .select("subject, payload, created_at")
        .eq("actor", agentId)
        .eq("kind", "coach.sales_review_generated")
        .order("id")
        .range(from, to),
    { label: "dashboard reviews" },
  ).catch(() => null);
  const reviewEvents = reviewEventsAll ?? [];
  const reviewedSubjects = new Set(reviewEvents.map((e) => String(e.subject ?? "")));
  const isReviewed = (sid: string) => reviewedSubjects.has(`sales_session:${sid}`);

  const reviewedCount = sessions.filter((s) => isReviewed(s.id as string)).length;
  // Awaiting = ended but not yet reviewed (so generating a review actually DRAINS this number).
  const awaitingReview = sessions.filter(
    (s) => s.status === "ended" && !isReviewed(s.id as string)
  ).length;
  // "Reviews generated" = distinct reviewed sessions (uncapped; can never exceed sessions).
  const reviewsGenerated = reviewedCount;

  // Recent growth opportunities from the most recent reviews (paged by id above, so sort by recency here).
  const recentGrowth: string[] = [];
  const sortedReviews = [...reviewEvents].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at))
  );
  for (const e of sortedReviews) {
    const ga = (e.payload as Record<string, unknown> | null)?.growth_areas;
    if (Array.isArray(ga)) {
      for (const g of ga) {
        const opp = (g as Record<string, unknown>)?.opportunity;
        if (typeof opp === "string" && opp.trim()) recentGrowth.push(opp.trim());
      }
    }
    if (recentGrowth.length >= 5) break; // only the top 5 are shown
  }

  // §3.4 honest-error-state (audit 2026-07-09): sessionsData drives EVERY stat —
  // if it (or the reviews read) failed, don't return all-zeros as if the rep had
  // no activity. Return 500 so the sessions page (which sets stats only on res.ok,
  // and hides the stat cards when stats is null) shows nothing rather than a
  // misleading empty readout. Happy path unchanged (fires only on a real error).
  if (sessionsData === null || reviewEventsAll === null) {
    return NextResponse.json(
      { error: "Couldn't load your dashboard right now — try again." },
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
