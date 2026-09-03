import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/coach/gamification/my-points — the signed-in rep's OWN points history: each banked session's points +
 * band + a link to its after-pitch (the private detail view). Reads the caller's own ledger rows via RLS (owner
 * read); this is their private data, not the public board. Powers the "Your progress" trend on the scoreboard.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "gamification-my-points", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = await createClient();
  // RLS: the caller reads their OWN ledger rows (agent_id = auth.uid()). session_score rows only — the per-session
  // banks (not corrections), oldest→newest so the trend reads left-to-right.
  const { data, error } = await supabase
    .from("agent_point_ledger")
    .select("session_id, points, detail, created_at")
    .eq("agent_id", ctx.userId)
    .eq("reason", "session_score")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[gamification-my-points] error:", error.message);
    return NextResponse.json({ error: "Couldn't load your points." }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => ({
    session_id: r.session_id as string | null,
    points: r.points as number,
    band: ((r.detail as { band?: string } | null)?.band ?? null) as string | null,
    created_at: r.created_at as string,
  }));
  const total = rows.reduce((s, r) => s + r.points, 0);
  const avg = rows.length ? Math.round((total / rows.length) * 10) / 10 : 0;
  return NextResponse.json({ rows, total, avg, sessions: rows.length });
}
