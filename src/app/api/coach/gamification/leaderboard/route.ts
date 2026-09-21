import { NextRequest, NextResponse } from "next/server";
import { rankOf } from "@/lib/coach/gamification/competitionRank";
import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";

/**
 * GET /api/coach/gamification/leaderboard?period=week|month|all
 *
 * The team scoreboard: per-agent rank + totals + deals for the caller's company. Reads the security-definer
 * aggregate function (0243) — NOT the ledger rows — so it exposes only the public layer (rank+totals), never
 * per-session score detail (which stays rep-private, A18). One DB query.
 *
 * MANAGER-ONLY AS OF 2026-09-22, and it was not before. The founder ruled that where the rubric sheet and
 * `docs/SalesCoach-KPI-System.md` conflict on anything a REP sees, the KPI document wins — and that document
 * says, in a clause it marks non-negotiable:
 *
 *   "Cross-agent ranking exists for managers only, is never the default view, and is never how results are
 *    framed to the agent."
 *
 * and again of the agent view: *"No cross-agent ranking here."*
 *
 * This route had served the full ranked board, with names, to every company member. It was built before the
 * ruling existed and was found by sweeping rep-facing surfaces against the document afterwards — the ruling is
 * general, and applying it only where I had already made a call would have left the older violation in place.
 *
 * A non-manager now receives no rows and no rank. Not a filtered board: a board of one is a wrong board, and a
 * rank is a rank however few people are on it. Their own points remain on the Arena, framed against their own
 * past, which is what the same document asks for.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-leaderboard", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req); // web cookie OR mobile Bearer (so the native app reuses this route)
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("period") ?? "all";
  const period = requested === "week" || requested === "month" ? requested : "all";

  // Caller-scoped: the mobile Bearer client (so auth_company_id() resolves inside the SECURITY DEFINER RPC), or the
  // web cookie client. Either way the RPC scopes to the caller's own company — never the service role.
  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await supabase.rpc("gamification_leaderboard", { p_period: period });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[gamification-leaderboard] rpc error:", error.message);
    return NextResponse.json({ error: "Couldn't load the scoreboard right now." }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{ agent_id: string; full_name: string | null; sessions: number; total_points: number; avg_points: number; best_points: number; deals: number }>;

  // The ranking gate, performed HERE rather than in the component. A value that never leaves the server cannot
  // be exposed by a rendering bug, and the board is a client component that anyone may refactor.
  const manager = await requireSalesCoachManager(req);
  if (!manager) {
    return NextResponse.json({ period, managerView: false, meId: ctx.userId });
  }

  const meIndex = rows.findIndex((r) => r.agent_id === ctx.userId);
  return NextResponse.json({
    period,
    managerView: true,
    rows,
    meId: ctx.userId,
    // rankOf, not meIndex + 1: equals share a place, so of two reps on an identical total neither is told they
    // came second. Null when they are not on the board — a rep with no scored session has no standing yet, which
    // is a different thing from being bottom of the list.
    meRank: rankOf(rows, meIndex),
  });
}
