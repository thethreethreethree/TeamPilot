import { NextResponse } from "next/server";
import { fetchAgentGrowth } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/agent/growth
 *
 * Returns the calling agent's own growth snapshot — 30 days of
 * resolutions, durability outcomes, and Co-Pilot edit magnitudes.
 *
 * Visibility: §3.6 + §A11. The agent sees their own data. Leaders
 * see aggregate (a future endpoint will surface the team view
 * without identifying individuals at low N). Never a verdict —
 * counts and patterns the agent decides what to do with.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const snapshot = await fetchAgentGrowth(auth.user.id);
  return NextResponse.json({ snapshot });
}
