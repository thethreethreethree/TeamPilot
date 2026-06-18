import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { fetchAgentConversation } from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { gradeCareAgentReply } from "@/lib/care/grader";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * POST /api/care/agent/conversations/[id]/ask-coach
 *
 * Pre-send Coach feedback on a draft. Differs from the
 * post-send grading flow (which auto-runs after the message is
 * inserted): this endpoint takes the CURRENT DRAFT (not yet
 * sent) and returns the same count-based output so the agent
 * can see what Coach would notice BEFORE they hit Send.
 *
 * §A11 — counts, never verdicts. Same rubric as the post-send
 * grader. The agent renders the verdict on whether the pattern
 * is fair before sending.
 *
 * §A16 direction 2 — if the draft was Co-Pilot-derived, the
 * client passes the Co-Pilot reasoning in the body. The grader
 * reads it the same way it does for post-send grading. Deliberate
 * shape choices don't get penalized pre-send either.
 *
 * §A7 — the response shape lets the UI render a next-step
 * affordance (the gaps and risks together imply what to do —
 * acknowledge, answer, offer next step, drop the absolute).
 */
const Body = z.object({
  draft: z.string().min(1).max(4000),
  coPilotReasoning: z.string().max(2000).optional().nullable(),
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

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  // Defense-in-depth: explicit company match check. RLS on
  // support_conversations also enforces it, but route-level
  // check makes the auth boundary auditable and survivable
  // to future RLS refactors. Same 404 shape so a guessed-id
  // from a different company can't be distinguished from
  // a truly-missing one.
  if (auth.companyId && detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  const visible = detail.messages
    .filter((m) => !m.isInternalNote)
    .slice(-8);
  const customerLast = [...visible]
    .reverse()
    .find((m) => m.authorType === "customer");
  if (!customerLast) {
    return NextResponse.json(
      { error: "No customer message to grade against yet." },
      { status: 400 }
    );
  }
  const contextTurns = visible
    .map((m) => {
      const role =
        m.authorType === "customer"
          ? "Customer"
          : m.authorType === "agent"
            ? "Agent (earlier)"
            : m.authorType === "ai"
              ? "AI (earlier)"
              : "System";
      return `${role}: ${m.body}`;
    })
    .join("\n");

  const productContext = await getProductContextForTenant(
    detail.conversation.companyId
  );

  const result = await gradeCareAgentReply({
    customerLastMessage: customerLast.body,
    agentReply: body.draft,
    conversationContext: contextTurns,
    productContext,
    coPilotReasoning: body.coPilotReasoning ?? null,
  });

  return NextResponse.json({
    counts: result.counts,
    derivedGrade: result.derivedGrade,
    reasonInternal: result.reasonInternal,
  });
}
