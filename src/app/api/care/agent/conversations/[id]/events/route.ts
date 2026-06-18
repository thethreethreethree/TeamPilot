import { NextRequest, NextResponse } from "next/server";
import {
  fetchAgentConversation,
  fetchConversationEvents,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // Defense-in-depth: verify the requested conversation belongs
  // to the caller's company before returning its timeline. RLS
  // on support_conversation_events also enforces it; route-level
  // check is defense-in-depth + makes the auth boundary
  // auditable.
  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  if (auth.companyId && detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  const events = await fetchConversationEvents(id);
  return NextResponse.json({ events });
}
