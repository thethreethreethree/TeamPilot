import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
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

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("period") ?? "all";
  const period = requested === "week" || requested === "month" ? requested : "all";

  const supabase = await createClient();
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
    meRank: meIndex >= 0 ? meIndex + 1 : null, // the caller's rank (1-based), or null if they have no points yet
  });
}
