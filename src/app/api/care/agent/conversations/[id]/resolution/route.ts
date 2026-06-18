import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  captureResolution,
  fetchAgentConversation,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * POST /api/care/agent/conversations/[id]/resolution
 *
 * Captures the resolution learning for a conversation. Called from
 * the resolution-capture form when an agent marks a conversation
 * resolved. Two questions:
 *   - What was the actual issue? (issue_summary)
 *   - What worked? (what_worked)
 * Optional category drives pattern detection downstream.
 *
 * Also marks the conversation status='resolved' if the form was
 * submitted from the "resolve" path — the trigger from 0036 then
 * schedules a durability check 7 days out.
 */

const Body = z.object({
  issueSummary: z.string().min(5).max(2000),
  whatWorked: z.string().min(5).max(2000),
  category: z.string().max(120).optional(),
  precedentResolutionId: z.string().uuid().optional(),
  alsoMarkResolved: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Defense-in-depth: verify the conversation belongs to the
  // caller's company before capturing a resolution against it.
  // Otherwise a forged conversation id from a peer tenant could
  // get a resolution attached (RLS on support_resolutions would
  // catch it, but explicit check makes the boundary auditable
  // and avoids the WRITE attempt entirely).
  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  if (detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  const resolution = await captureResolution({
    conversationId: id,
    companyId: auth.companyId,
    capturedBy: auth.agentId,
    issueSummary: body.issueSummary,
    whatWorked: body.whatWorked,
    category: body.category ?? null,
    precedentResolutionId: body.precedentResolutionId ?? null,
  });

  if (body.category) {
    // Also stamp the category on the conversation for fast filtering
    // (pattern detection page reads from here directly).
    await auth.sb
      .from("support_conversations")
      .update({ resolution_outcome_category: body.category })
      .eq("id", id);
  }

  if (body.alsoMarkResolved) {
    await auth.sb
      .from("support_conversations")
      .update({ status: "resolved" })
      .eq("id", id);
  }

  return NextResponse.json({ resolution });
}
