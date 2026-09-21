import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { rateLimit } from "@/lib/api/rateLimit";
import { readPitchPeriod } from "@/lib/coach/pitchScore/readPitchPeriod";
import { buildPitchLeaderboard, standingOf, gapsAround } from "@/lib/coach/pitchScore/leaderboard";

/**
 * GET /api/coach/sales-session/pitch-score/leaderboard?period=week|month|all
 *
 * The Pitch Score competition board (rubric p.6). Total points from counted pitches, standard
 * competition ranking.
 *
 * TWO CALLERS, TWO ANSWERS, AND THE SPLIT IS THE POINT.
 *
 *   A MANAGER gets the board: every rep, ranked, with totals.
 *   A REP gets their own standing and nothing else — "3rd of 9" — never another rep's name or
 *   number.
 *
 * This is not a UX preference, it is what the two governing documents jointly require, and they
 * disagree with each other (noted, not silently applied, per the founder's standing instruction —
 * LOGIC-AND-CONTRADICTIONS.md section L):
 *
 *   `docs/SalesCoach-KPI-System.md`, marked non-negotiable: *"Cross-agent ranking exists for
 *   managers only, is never the default view, and is never how results are framed to the agent."*
 *
 *   The rubric sheet (p.6): Pitch Score IS the competition leaderboard — and a competition no
 *   competitor can see is not one.
 *
 * FOUNDER RULING, 2026-09-22: when the rubric sheet and the KPI document conflict on anything a
 * REP sees, the KPI document wins. That settled three calls I had made myself, and it overturned
 * two of them.
 *
 * So a rep no longer receives their RANK or the size of the field. "3rd of 9" is cross-agent
 * ranking reaching the agent, which the KPI document forbids in as many words, and my earlier
 * reading — that a reduced form was a fair compromise — was the builder deciding how much of a
 * non-negotiable clause to honour.
 *
 * What a rep still gets is their OWN totals and ONE distance: how far behind the rep immediately
 * above them. That is kept because it is a target rather than a position — a number they can close
 * by pitching better. The gap to the rep BELOW is gone for the mirror reason: a cushion is a
 * position to defend, and defending a position is the stress machine the KPI document names.
 *
 * The database said the same thing first — 0252's select policy is
 * `rep_id = auth.uid() or is_sales_coach_manager()` — so a rep reading through their own client
 * would have received a board containing only themselves, ranked first, every time. That failure
 * mode is why the rep path uses an explicitly-scoped service-role read: a board of one is not a
 * smaller board, it is a wrong one.
 *
 * Recorded in LOGIC-AND-CONTRADICTIONS.md section L.
 */

const PERIODS = new Set(["week", "month", "all"]);

/** Inclusive ISO start for a period, or undefined for all time. */
function fromFor(period: string): string | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (period === "week" ? 7 : 30));
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "pitch-score-leaderboard", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("period") ?? "all";
  const period = PERIODS.has(requested) ? requested : "all";
  const from = fromFor(period);

  const manager = await requireSalesCoachManager(req);
  // The manager path already proved a company. The rep path resolves theirs through their OWN
  // client, so RLS decides which profile row they may read — the company is never taken from
  // anything the caller sent.
  const companyId =
    manager?.companyId ??
    (await callerCompanyId(callerScopedDb(req) ?? (await createClient()), ctx.userId));
  if (!companyId) {
    return NextResponse.json({ error: "No company for this account." }, { status: 403 });
  }

  // Service role, scoped to the caller's proven company on the way in.
  //
  // Necessary for BOTH callers and for different reasons: a rep cannot read other reps' pitches
  // under RLS (and needs the whole company to know their own rank), and a manager could read them
  // but would then be running the board through a different client than the rep does — two code
  // paths producing one number is the shape that drifts.
  const admin = createAdminClient();
  const read = await readPitchPeriod({ from, companyId, limit: 900 }, admin);
  if (!read) {
    // readPitchPeriod logs the detail. Returning an empty board here would tell a team that nobody
    // scored this week, which is the error-as-no-data class this codebase has paid for twice.
    return NextResponse.json({ error: "Couldn't load the board right now." }, { status: 500 });
  }

  const rows = buildPitchLeaderboard(read.pitches);
  const standing = standingOf(rows, ctx.userId);
  // Distances, not identities. This is what lets a rep see it at all — a gap is not a person,
  // so it carries the competition without cross-agent ranking becoming how results are framed.
  const gaps = gapsAround(rows, ctx.userId);

  if (!manager) {
    // A rep. Their own totals, and ONE distance.
    //
    // `rank` and `boardSize` are withheld deliberately, not omitted for brevity: they are the
    // cross-agent ranking the KPI document says is manager-only. They are stripped HERE rather
    // than hidden in the component, because a value that never leaves the server cannot be
    // exposed by a rendering bug — and the component is the layer most likely to be refactored by
    // someone who has not read this docblock.
    return NextResponse.json({
      period,
      managerView: false,
      standing: standing
        ? {
            repId: standing.repId,
            total_points: standing.total_points,
            counted: standing.counted,
            pitchesTotal: standing.pitchesTotal,
            avgPitchScore: standing.avgPitchScore,
            bestPitchScore: standing.bestPitchScore,
            prizeEligible: standing.prizeEligible,
          }
        : null,
      // A target, not a cushion. `ahead` is dropped for the same reason `rank` is.
      gaps: { behind: gaps.behind, ahead: null },
      skippedPreVerdict: read.skippedPreVerdict,
      capped: read.capped,
    });
  }

  // Names, for the manager view only. Scoped to the same proven company AND to the rep ids already
  // on the board, so this cannot become a roster read: a manager learns the names of people whose
  // scores they can already see, and nothing else.
  const names = new Map<string, string>();
  if (rows.length > 0) {
    const { data: profiles, error: nameError } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .in("id", rows.map((r) => r.repId));
    if (nameError) {
      // Not fatal. A board with ids instead of names is degraded; a 500 because a name lookup
      // failed would withhold the scores themselves, which is the worse trade.
      // eslint-disable-next-line no-console
      console.error(`[pitch-leaderboard] name lookup failed: ${nameError.message}`);
    }
    for (const p of profiles ?? []) {
      if (p.full_name) names.set(String(p.id), String(p.full_name));
    }
  }

  return NextResponse.json({
    period,
    managerView: true,
    rows: rows.map((r) => ({ ...r, fullName: names.get(r.repId) ?? null })),
    meId: ctx.userId,
    standing,
    gaps,
    boardSize: rows.length,
    skippedPreVerdict: read.skippedPreVerdict,
    // A truncated read matters MORE here than on the milestones strip: a leaderboard total
    // is a sum over the period, so losing the oldest pitches lowers real totals and can
    // reorder the board. Silent truncation was named in this build's own residual.
    capped: read.capped,
  });
}
