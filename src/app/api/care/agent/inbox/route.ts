import { NextRequest, NextResponse } from "next/server";
import { fetchAgentInbox, fetchEnrichedInbox } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/agent/inbox
 * GET /api/care/agent/inbox?enriched=1
 *
 * Agent-side. Returns all conversations in the agent's company,
 * sorted by last activity. RLS scopes by company; we additionally
 * check the caller is a support agent (or company admin) so a
 * regular Member doesn't see the inbox.
 *
 * The ?enriched=1 query param returns the enriched shape
 * (priority, snooze, tags, customer joined in) for the
 * master-detail UI and the Care Home dashboard.
 */
export async function GET(req: NextRequest) {
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
    return NextResponse.json(
      { error: "Care inbox is agent-only." },
      { status: 403 }
    );
  }

  const enriched = req.nextUrl.searchParams.get("enriched") === "1";
  if (enriched) {
    const conversations = await fetchEnrichedInbox();
    return NextResponse.json({ conversations });
  }
  const conversations = await fetchAgentInbox();
  return NextResponse.json({ conversations });
}
