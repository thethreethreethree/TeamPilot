import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { generateTeamTrainingBrief } from "@/lib/coach/v5/teamTrainingBrief";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/coach/sales-session/team-training-brief — MANAGER-gated. Generates a TEAM training brief from the last
 * period's pooled coaching signal (growth areas + strategy gaps) + door activity, for the manager to run in the next
 * team meeting (founder 2026-08-26). One LLM call; rate-limited like the sibling coach LLM routes. 403s non-managers.
 */

const resolve = async () => {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: null,
  });
  return { ok: true as const, companyId: (profile?.company_id as string | null) ?? null, isManager };
};

// One LLM generation per call; matches /finalize's ceiling so the reasoning model isn't truncated.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-team-training-brief", windowMs: 60_000, max: 6 });
  if (limited) return limited;

  const ctx = await resolve();
  if (!ctx.ok) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });
  if (!ctx.isManager) return NextResponse.json({ error: "The team training brief is for managers." }, { status: 403 });

  try {
    const result = await generateTeamTrainingBrief(ctx.companyId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[coach/team-training-brief] failed:", err);
    return NextResponse.json(
      { error: "Couldn't build the team training brief right now — please try again in a moment." },
      { status: 500 },
    );
  }
}
