import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  fetchAgentConversation,
  claimConversation,
  setConversationStatus,
  type SupportConversation,
} from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/care/agent/conversations/[id]
 * PATCH /api/care/agent/conversations/[id]
 *
 * Agent-only. GET returns the conversation + all messages
 * (including internal notes). PATCH supports two operations:
 *   - claim: assigns the calling agent + flips ai_responding off
 *   - status: change to in_conversation / awaiting_customer /
 *             resolved / closed
 *
 * RLS already scopes to the company; we additionally gate by
 * is_support_agent OR company-admin role.
 */

const PatchBody = z.object({
  action: z.enum(["claim", "status"]),
  status: z
    .enum(["open", "in_conversation", "awaiting_customer", "resolved", "closed"])
    .optional(),
});

async function requireAgent() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
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
  if (!isAgent) return { error: "Care is agent-only.", status: 403 } as const;
  return { agentId: auth.user.id };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireAgent();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const data = await fetchAgentConversation(id);
  if (!data) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireAgent();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

  if (body.action === "claim") {
    await claimConversation({ conversationId: id, agentId: auth.agentId });
  } else if (body.action === "status") {
    if (!body.status) {
      return NextResponse.json(
        { error: "status action requires a status field." },
        { status: 400 }
      );
    }
    await setConversationStatus({
      conversationId: id,
      status: body.status as SupportConversation["status"],
    });
  }
  return NextResponse.json({ ok: true });
}
