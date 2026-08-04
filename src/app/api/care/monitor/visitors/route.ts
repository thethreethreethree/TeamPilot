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
 * shows an honest empty state rather than a failure. A GENUINE read failure
 * stays loud: fetchLiveVisitors rethrows it, and this route turns it into a
 * 500 so the monitor page (which checks res.ok) keeps the prior visitors +
 * shows an error, instead of flashing the live list empty (error-as-no-data).
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

  try {
    const visitors = await fetchLiveVisitors(auth.companyId);
    return NextResponse.json({ visitors });
  } catch {
    // Explicit generic 500 (not the framework default) — consistent with the agent-inbox and
    // widget load-events routes, and never leaks a raw error to the client (CWE-209).
    return NextResponse.json(
      { error: "Couldn't load live visitors." },
      { status: 500 }
    );
  }
}
