import { NextResponse } from "next/server";
import { fetchAgentGrowth } from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // Growth is scoped to the calling agent — auth.agentId is the
  // identity we report against. No conversation-level company
  // check needed (the helper already verified the agent IS an
  // agent of A company; the snapshot is per-user not per-company).
  const snapshot = await fetchAgentGrowth(auth.agentId);
  return NextResponse.json({ snapshot });
}
