import { NextResponse } from "next/server";
import { fetchCoachAssessmentRoster } from "@/lib/data/careCoachAssessment";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/coach-assessment
 *
 * Per-agent C.A.R.E coaching roster for managers (founder 2026-07-22). The Sales-Coach-style per-agent
 * view, brought to C.A.R.E with founder sign-off + the same §A18 guardrails (alphabetical never
 * grade-sorted, graded vs a fixed standard not peers, coaching-framed, no F).
 *
 * Visibility: CEO / COO / admin only — same gate as /api/care/leadership/team. Regular agents see their
 * OWN grade on /dashboard/care/growth (§A10), not this roster.
 */
export async function GET() {
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
    return NextResponse.json({ error: "No company on profile." }, { status: 403 });
  }
  const isLeader =
    profile.role === "CEO" || profile.role === "COO" || profile.role === "admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Coach Assessment is for company admins." },
      { status: 403 }
    );
  }

  try {
    const roster = await fetchCoachAssessmentRoster(profile.company_id);
    return NextResponse.json({ roster });
  } catch {
    // §3.4 — honest error, distinct from an empty roster.
    return NextResponse.json({ degraded: true }, { status: 200 });
  }
}
