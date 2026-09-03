import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * GET /api/coach/gamification/my-points — the signed-in rep's OWN points history: each banked session's points +
 * band + a link to its after-pitch (the private detail view). Reads the caller's own ledger rows via RLS (owner
 * read); this is their private data, not the public board. Powers the "Your progress" trend on the scoreboard.
 *
 * The summary (total / avg / sessions) is computed over the rep's FULL history, paged past the 1000-row cap, so it
 * matches the leaderboard's authoritative SUM for the same rep. A prior `.limit(200)` here diverged from the board
 * past 200 sessions AND (being ascending+limit) surfaced the OLDEST 200, not the recent ones — the silent-truncation
 * class. The per-session `rows` returned for the trend are then bounded to the most RECENT window for payload size.
 */
const TREND_WINDOW = 200;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-my-points", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = await createClient();
  // RLS: the caller reads their OWN ledger rows (agent_id = auth.uid()). session_score rows only — the per-session
  // banks (not corrections), oldest→newest so the trend reads left-to-right. Paged so the summary is over the FULL
  // set (not a truncated page), keeping total/avg/sessions consistent with the board.
  type LedgerRow = { session_id: string | null; points: number; detail: { band?: string } | null; created_at: string };
  const { data, error } = await fetchAllPagedResult<LedgerRow>(
    (from, to) =>
      supabase
        .from("agent_point_ledger")
        .select("session_id, points, detail, created_at")
        .eq("agent_id", ctx.userId)
        .eq("reason", "session_score")
        .order("created_at", { ascending: true })
        .range(from, to),
    { label: "my-points ledger" },
  );
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("[gamification-my-points] error:", error?.message);
    return NextResponse.json({ error: "Couldn't load your points." }, { status: 500 });
  }

  const all = data.map((r) => ({
    session_id: r.session_id,
    points: r.points,
    band: (r.detail?.band ?? null) as string | null,
    created_at: r.created_at,
  }));
  // Authoritative summary over the FULL history (matches the leaderboard).
  const total = all.reduce((s, r) => s + r.points, 0);
  const avg = all.length ? Math.round((total / all.length) * 10) / 10 : 0;
  // Trend payload: the most RECENT window, still ascending so it reads left→right.
  const rows = all.slice(-TREND_WINDOW);
  return NextResponse.json({ rows, total, avg, sessions: all.length });
}
