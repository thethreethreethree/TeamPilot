import { NextRequest, NextResponse } from "next/server";
import { fetchAgentInbox, fetchEnrichedInbox } from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/inbox
 * GET /api/care/agent/inbox?enriched=1
 *
 * Agent-side. Returns all conversations in the agent's company,
 * sorted by last activity. RLS scopes by company; the shared
 * requireCareAgent gate additionally checks the caller is a
 * support agent (or company admin) so a regular Member doesn't
 * see the inbox.
 *
 * The ?enriched=1 query param returns the enriched shape
 * (priority, snooze, tags, customer joined in) for the
 * master-detail UI and the Care Home dashboard.
 */
export async function GET(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const enriched = req.nextUrl.searchParams.get("enriched") === "1";
  if (enriched) {
    const conversations = await fetchEnrichedInbox();
    return NextResponse.json({ conversations });
  }
  const conversations = await fetchAgentInbox();
  return NextResponse.json({ conversations });
}
