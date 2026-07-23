import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchLiveVisitors } from "@/lib/data/care";

/**
 * GET /api/care/monitor/visitors
 *
 * Agent-authenticated. Returns the tenant's currently-present anonymous
 * visitors (last heartbeat within VISITOR_PRESENCE_WINDOW_SECONDS), most
 * recent first, for the Live Monitor page. Scoped to the caller's company
 * by requireCareAgent — an agent can only ever see their own tenant's
 * visitors. Returns [] (not an error) if 0192 is unapplied, so the page
 * shows an honest empty state rather than a failure.
 */
export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json(
      { error: "No company on profile." },
      { status: 403 }
    );
  }

  const visitors = await fetchLiveVisitors(auth.companyId);
  return NextResponse.json({ visitors });
}
