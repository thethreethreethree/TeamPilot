import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * GET /api/brain/learning-summary
 *
 * §3.6 surface — "What the System has noticed about your team."
 * Aggregates §3.1 chain events into honest activity readouts so the
 * user can see concrete evidence the System is accumulating something
 * specific to their team. Per the constitution, a value curve nobody
 * can see is commercially a flat line.
 *
 * Constitutional framing:
 *   - Counts, not verdicts (A11 mirror frame applied to readouts too).
 *   - Comparison to prior period is signal, not judgment.
 *   - Honest empty states — low-activity companies see "not enough
 *     yet" rather than fabricated metrics. §3.4 (no instant results)
 *     means a brand-new team should see explicit "accumulating".
 *   - §3.5 durability is the consequence measure (held, not accepted).
 *
 * Windows:
 *   - last7Days  vs prior7Days  → Coach activity, chain growth
 *   - last28Days                → Decisions, topic resolutions
 *   - all-time                  → Cumulative pattern observation count
 */

type CoachHeuristicId =
  | "nvc-evaluation"
  | "voss-bare-assertion"
  | "stone-identity-collision"
  | "coach-blame-projection"
  | "coach-emotional-escalation"
  | "coach-hot-state"
  | "coach-aggressive-language";

type CoachStats = {
  patternsObserved: number;
  suggestionsOffered: number;
  suggestionsAccepted: number;
  suggestionsDismissed: number;
  byHeuristic: Partial<Record<CoachHeuristicId, number>>;
};

const ZERO_COACH: CoachStats = {
  patternsObserved: 0,
  suggestionsOffered: 0,
  suggestionsAccepted: 0,
  suggestionsDismissed: 0,
  byHeuristic: {},
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json({
      ready: false,
      reason: "Supabase not configured.",
    });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id;
  if (!companyId) {
    return NextResponse.json(
      { ready: false, reason: "Complete onboarding first." },
      { status: 200 }
    );
  }

  // Window boundaries
  const now = new Date().toISOString();
  const last7 = isoDaysAgo(7);
  const prior7Start = isoDaysAgo(14);
  const last28 = isoDaysAgo(28);

  // ─── Coach activity ────────────────────────────────────────
  const coachKinds = [
    "coach.pattern_observed",
    "coach.suggestion_offered",
    "coach.suggestion_accepted",
    "coach.suggestion_dismissed",
  ];
  // All seven reads below depend only on companyId + the precomputed date strings
  // — none consumes another's result — so they run concurrently (Promise.all) instead
  // of seven serial serverless round-trips on this §3.6 command-center load. The
  // in-memory aggregation (which DOES need the returned rows) stays sequential after.
  // Supabase returns {data|count, error} (never throws), so the per-read error vars and
  // the §3.4 chainReadError combine below are byte-identical to the sequential form.
  const [
    { data: coachEvents, error: eCoach },
    { count: cumulativePatternsRaw, error: eCumulative },
    { data: decisionEvents, error: eDecision },
    { data: topicRows, error: eTopic },
    { count: chainLast7, error: eChain7 },
    { count: chainPrior7, error: eChainP },
    { count: chainTotalAllTime, error: eChainTotal },
  ] = await Promise.all([
    // Paged (was a fixed 2000-row cap → PostgREST returns <=1000, truncating the coach-event aggregation for a
    // busy team past 1000 events in the ~14-day window). Order by the uuid `id` (stable, unique) — aggregateCoach
    // filters by window + counts, so it is order-independent. Adapted to the {data,error} shape the Promise.all +
    // §3.4 chainReadError combine expect; fetchAllPaged throws on a read error → mapped to `error`.
    fetchAllPagedResult<{ kind: string; payload: unknown; occurred_at: string }>(
      (from, to) =>
        supabase
          .from("events")
          .select("kind, payload, occurred_at")
          .eq("company_id", companyId)
          .in("kind", coachKinds)
          .gte("occurred_at", prior7Start)
          .order("id")
          .range(from, to),
      { label: "learning-summary coach events" },
    ),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("kind", "coach.pattern_observed"),
    supabase
      .from("events")
      .select("kind, payload, occurred_at")
      .eq("company_id", companyId)
      .in("kind", ["decision.opened", "decision.decided", "decision.phase_entered"])
      .gte("occurred_at", last28)
      .limit(1000),
    supabase
      .from("chat_topics")
      .select("id, status, close_durability, created_at, closed_at")
      .eq("company_id", companyId)
      .gte("created_at", last28)
      .limit(500),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("occurred_at", last7),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("occurred_at", prior7Start)
      .lt("occurred_at", last7),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
  ]);

  const aggregateCoach = (windowStart: string, windowEnd: string): CoachStats => {
    const stats: CoachStats = {
      patternsObserved: 0,
      suggestionsOffered: 0,
      suggestionsAccepted: 0,
      suggestionsDismissed: 0,
      byHeuristic: {},
    };
    for (const e of coachEvents ?? []) {
      if (e.occurred_at < windowStart || e.occurred_at >= windowEnd) continue;
      switch (e.kind) {
        case "coach.pattern_observed":
          stats.patternsObserved += 1;
          break;
        case "coach.suggestion_offered":
          stats.suggestionsOffered += 1;
          break;
        case "coach.suggestion_accepted":
          stats.suggestionsAccepted += 1;
          break;
        case "coach.suggestion_dismissed":
          stats.suggestionsDismissed += 1;
          break;
      }
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const hid =
        (payload.heuristic_id as CoachHeuristicId | undefined) ??
        (payload.citation as { id?: CoachHeuristicId } | undefined)?.id;
      if (hid) {
        stats.byHeuristic[hid] = (stats.byHeuristic[hid] ?? 0) + 1;
      }
    }
    return stats;
  };

  const coachLast7 = aggregateCoach(last7, now);
  const coachPrior7 = aggregateCoach(prior7Start, last7);

  // Top 3 patterns last 7 days
  const topPatterns = Object.entries(coachLast7.byHeuristic)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([id, count]) => ({
      heuristicId: id as CoachHeuristicId,
      count: count ?? 0,
      priorCount: coachPrior7.byHeuristic[id as CoachHeuristicId] ?? 0,
    }));

  // ─── Cumulative pattern observations (all time) ──────────── (read in the Promise.all above)
  const cumulativePatterns = cumulativePatternsRaw ?? 0;

  // ─── Decision activity (last 28d) ────────────────────────── (read in the Promise.all above)
  const decisionStats = {
    opened: 0,
    decided: 0,
    byPath: { user: 0, system: 0, hybrid: 0, defer: 0 } as Record<
      string,
      number
    >,
  };
  for (const e of decisionEvents ?? []) {
    if (e.kind === "decision.opened") decisionStats.opened += 1;
    if (e.kind === "decision.decided") {
      decisionStats.decided += 1;
      const path = ((e.payload ?? {}) as { chosen_path?: string }).chosen_path;
      if (path && path in decisionStats.byPath) {
        decisionStats.byPath[path] = (decisionStats.byPath[path] ?? 0) + 1;
      }
    }
  }

  // ─── Topic activity (last 28d) + durability ──────────────── (read in the Promise.all above)
  const topicStats = {
    opened: 0,
    closed: 0,
    durability: { held: 0, partial: 0, reopened: 0, unknown: 0, unrated: 0 },
  };
  for (const t of topicRows ?? []) {
    topicStats.opened += 1;
    if (t.status === "closed") {
      topicStats.closed += 1;
      const d = (t.close_durability as keyof typeof topicStats.durability | null) ?? null;
      if (d && d in topicStats.durability) {
        topicStats.durability[d] += 1;
      } else {
        topicStats.durability.unrated += 1;
      }
    }
  }

  // Chain-activity counts (chainLast7 / chainPrior7 / chainTotalAllTime) are read in the
  // Promise.all above. Honest readiness gate — if the chain has fewer than ~30 events total,
  // we haven't accumulated enough to make any readout meaningful. Be explicit about that
  // instead of showing tiny numbers as if they were signal.

  // §3.4 honest-error-state (audit 2026-07-09): if ANY chain read failed, do NOT
  // render zeros/low numbers as if they were real activity — that makes the
  // §3.6 command center LIE about team health on a transient DB hiccup ("the
  // team did nothing" when the read just failed). Return the route's own
  // ready:false + reason contract, which the UI already renders honestly as
  // "Learning surface unavailable" (same discipline as the list route +
  // sessions page). Happy path unchanged: no error → ready:true below.
  const chainReadError =
    eCoach ?? eCumulative ?? eDecision ?? eTopic ?? eChain7 ?? eChainP ?? eChainTotal;
  if (chainReadError) {
    return NextResponse.json({
      ready: false,
      reason: "Couldn't read the chain right now — try again shortly.",
    });
  }
  const accumulating = (chainTotalAllTime ?? 0) < 30;

  return NextResponse.json({
    ready: true,
    accumulating,
    windows: {
      last7Days: { from: last7, to: now },
      prior7Days: { from: prior7Start, to: last7 },
      last28Days: { from: last28, to: now },
    },
    coach: {
      last7Days: coachLast7,
      prior7Days: coachPrior7,
      topPatterns,
      cumulativePatterns,
    },
    decisions: { last28Days: decisionStats },
    topics: { last28Days: topicStats },
    chain: {
      last7Days: chainLast7 ?? 0,
      prior7Days: chainPrior7 ?? 0,
      totalAllTime: chainTotalAllTime ?? 0,
    },
  });
}

// Allow unused — anchors zero shape if a future code path needs it.
void ZERO_COACH;
