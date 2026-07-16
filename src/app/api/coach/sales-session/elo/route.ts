import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager, canManagerViewRepSkills } from "@/lib/coach/v5/skillAccess";
import { getAgentEloRating } from "@/lib/coach/v5/salesElo";

/**
 * GET /api/coach/sales-session/elo?agentId=<id>
 *
 * The Agent Sales Effectivity Rating (ELO vs. our measurement standard).
 *
 * Access (§A10 + §A18, founder 2026-07-07): a rep may read their OWN rating
 * (no shadow read — §A10), and a same-company MANAGER/admin may read any of
 * their reps' ratings (the coaching surface). NOT a leaderboard — this returns
 * ONE agent's own curve, never a ranked comparison to peers. The rating is a
 * growth metric derived from the owner-private after-pitch data; the raw private
 * per-call scores are never returned here.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "sales-session-elo",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  // The cross-person gate lives in ONE place (skillAccess), not four (A13/A28/INVARIANT 6). This route had the
  // FOURTH inline copy of "who counts as a manager" — provably identical to isSalesCoachManager, and missed by
  // the consolidation that fixed list/ and team/ earlier in this session. INVARIANT 6 found it. Behaviour is
  // preserved exactly: same order (manager check before the target fetch), same 403 for a non-manager peer,
  // same 404 for a cross-company target.
  const caller = {
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: companyId,
  };

  const agentId = req.nextUrl.searchParams.get("agentId") || auth.user.id;
  const isSelf = agentId === auth.user.id;

  if (!isSelf && !isSalesCoachManager(caller)) {
    // A rep may only see their own rating; peers' ratings need manager access.
    return NextResponse.json(
      { error: "You can only view your own rating." },
      { status: 403 }
    );
  }

  // When a manager views another rep, that rep must be in the same company.
  if (!isSelf) {
    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", agentId)
      .maybeSingle();
    if (!canManagerViewRepSkills(caller, target ?? null).ok) {
      return NextResponse.json(
        { error: "Agent not found in your company." },
        { status: 404 }
      );
    }
  }
  const elo = await getAgentEloRating(agentId);
  // §A18 exposure discipline: the per-session `history` (each game's derived
  // gameScore) is a finer read of the rep's owner-private scores than "managers
  // see the rating" needs. The OWNER gets their full history (§A10 — their own
  // data); a MANAGER gets only the rating, games played, provisional flag, and
  // the latest trend delta — never the per-session breakdown.
  const lastDelta = elo.history.length
    ? elo.history[elo.history.length - 1]!.delta
    : 0;
  return NextResponse.json({
    elo: {
      rating: elo.rating,
      gamesPlayed: elo.gamesPlayed,
      provisional: elo.provisional,
      lastDelta,
      history: isSelf ? elo.history : [],
    },
  });
}
