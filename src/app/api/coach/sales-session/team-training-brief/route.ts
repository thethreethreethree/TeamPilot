import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  generateTeamTrainingBrief,
  storeTeamBrief,
  getLatestTeamBrief,
} from "@/lib/coach/v5/teamTrainingBrief";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * Team training brief (founder 2026-08-26; day/week + pre-generation 2026-08-27). MANAGER-gated.
 *   GET  → the latest PRE-GENERATED brief (the overnight cron caches it) so the manager opens to a ready brief.
 *   POST → generate live for a chosen window ({period:"day"|"week"}), cache it, and return it (Build / Rebuild).
 * The brief pools the period's coaching signal + door activity for the next team meeting. 403s non-managers.
 */

// day → 1, week → 7 (default). The look-back window the founder's day/week toggle chooses.
const PeriodBody = z.object({ period: z.enum(["day", "week"]).optional() });
const daysFor = (period?: "day" | "week") => (period === "day" ? 1 : 7);

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

// GET — the latest PRE-GENERATED brief (or null if the cron hasn't run / there's no signal yet). Manager-gated.
export async function GET() {
  const ctx = await resolve();
  if (!ctx.ok) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });
  if (!ctx.isManager) return NextResponse.json({ error: "The team training brief is for managers." }, { status: 403 });
  const cached = await getLatestTeamBrief(ctx.companyId).catch(() => null);
  return NextResponse.json({ cached });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-team-training-brief", windowMs: 60_000, max: 6 });
  if (limited) return limited;

  const ctx = await resolve();
  if (!ctx.ok) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });
  if (!ctx.isManager) return NextResponse.json({ error: "The team training brief is for managers." }, { status: 403 });

  const body = await readBody(req, PeriodBody);
  if (body instanceof NextResponse) return body;
  const periodDays = daysFor(body.period);

  try {
    const result = await generateTeamTrainingBrief(ctx.companyId, periodDays);
    // Cache the fresh brief too, so a reload shows it "ready" (best-effort, non-blocking of the response contract).
    if (result.ok) await storeTeamBrief(ctx.companyId, result, periodDays);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[coach/team-training-brief] failed:", err);
    return NextResponse.json(
      { error: "Couldn't build the team training brief right now — please try again in a moment." },
      { status: 500 },
    );
  }
}
