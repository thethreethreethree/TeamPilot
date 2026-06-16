import { NextResponse } from "next/server";
import { fetchTeamGrowth } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/leadership/team
 *
 * Returns the team-aggregate growth snapshot. Per §A18 there is
 * NO individual breakdown — the leader sees team-aggregate only,
 * never per-agent comparison or stack-rank. Per §A10 every field
 * surfaced here is already visible to each agent on their own
 * /dashboard/care/growth page; nothing new is revealed to the
 * leader that the agent doesn't already see about themselves.
 *
 * Visibility: §A18-shaped role gate. CEO / COO / admin only.
 * Regular agents see their own self-view (/dashboard/care/growth),
 * not this aggregate.
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
      { error: "Leadership view is for company admins." },
      { status: 403 }
    );
  }
  const snapshot = await fetchTeamGrowth(profile.company_id);
  return NextResponse.json({ snapshot });
}
