import { NextRequest, NextResponse } from "next/server";
import { rankOf } from "@/lib/coach/gamification/competitionRank";
import { createClient } from "@/lib/supabase/server";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/coach/gamification/leaderboard?period=week|month|all
 *
 * The team scoreboard: per-agent rank + totals + deals for the caller's company. Reads the security-definer
 * aggregate function (0243) — NOT the ledger rows — so it exposes only the public layer (rank+totals), never
 * per-session score detail (which stays rep-private, A18). Every company member may view it. One DB query.
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
  const meIndex = rows.findIndex((r) => r.agent_id === ctx.userId);
  return NextResponse.json({
    period,
    rows,
    meId: ctx.userId,
    // rankOf, not meIndex + 1: equals share a place, so of two reps on an identical total neither is told they
    // came second. Null when they are not on the board — a rep with no scored session has no standing yet, which
    // is a different thing from being bottom of the list.
    meRank: rankOf(rows, meIndex),
  });
}
