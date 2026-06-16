import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { postAgentMessage } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/care/agent/conversations/[id]/messages
 *
 * Agent posts a reply to a customer (or an internal note).
 * Internal notes are agent-only — the customer widget never
 * fetches them.
 */

const Body = z.object({
  body: z.string().min(1).max(4000),
  isInternalNote: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
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
    return NextResponse.json(
      { error: "Care is agent-only." },
      { status: 403 }
    );
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const msg = await postAgentMessage({
    conversationId: id,
    body: body.body,
    agentId: auth.user.id,
    isInternalNote: !!body.isInternalNote,
  });
  if (!msg) {
    return NextResponse.json(
      { error: "Couldn't post the message." },
      { status: 500 }
    );
  }
  return NextResponse.json({ message: msg });
}
