import { NextRequest, NextResponse } from "next/server";
import {
  fetchCoachRubricReadout,
  fetchCoPilotValueReadout,
  fetchRoutingReadout,
  fetchSlaWithDurabilityReadout,
} from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/leadership/readouts
 *
 * Phase 7 §4 readouts. Returns the durability comparison between
 * Coach v6, v5, and ungraded cohorts for the calling company.
 *
 * Per §A2 this endpoint exists so the Coach v6 reframe can be
 * MEASURED against the alternative, on real conversations, with
 * before/after rigor. The data layer returns counts only; the
 * UI consumer renders them honestly without a "v6 wins" verdict.
 *
 * Visibility: CEO / COO / admin only. Per §A11 the comparison
 * is the kind of company-level analytic that helps a leader
 * decide whether to keep investing in a methodology, not agent
 * surveillance.
 *
 * Query params:
 *   windowDays — defaults to 60 (matches §3.4 measurement window)
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) {
    return NextResponse.json(
      { error: "No company on profile." },
      { status: 403 }
    );
  }
  const isLeader =
    profile.role === "CEO" ||
    profile.role === "COO" ||
    profile.role === "admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Readouts are for company admins." },
      { status: 403 }
    );
  }

  const windowDaysParam = req.nextUrl.searchParams.get("windowDays");
  const windowDays = windowDaysParam ? parseInt(windowDaysParam, 10) : 60;

  const [coachRubric, coPilotValue, routing, slaWithDurability] =
    await Promise.all([
      fetchCoachRubricReadout({
        companyId: profile.company_id,
        windowDays,
      }),
      fetchCoPilotValueReadout({
        companyId: profile.company_id,
        windowDays,
      }),
      fetchRoutingReadout({
        companyId: profile.company_id,
        windowDays,
      }),
      fetchSlaWithDurabilityReadout({
        companyId: profile.company_id,
        windowDays,
      }),
    ]);

  return NextResponse.json({
    coachRubric,
    coPilotValue,
    routing,
    slaWithDurability,
  });
}
