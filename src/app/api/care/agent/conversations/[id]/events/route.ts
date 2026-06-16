import { NextRequest, NextResponse } from "next/server";
import { fetchConversationEvents } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/agent/conversations/[id]/events
 *
 * Returns the timeline events for a conversation (status changes,
 * assignments, tags, priority, snooze). Used by the customer panel
 * sidebar in the Conversations app.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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
    return NextResponse.json({ error: "Care is agent-only." }, { status: 403 });
  }
  const events = await fetchConversationEvents(id);
  return NextResponse.json({ events });
}
