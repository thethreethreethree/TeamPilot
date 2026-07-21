import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAgentConversation } from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { generateCareReply } from "@/lib/claude";
import {
  askCoachSystemPrompt,
  userHasSharedThinking,
  buildCoachUserMessage,
} from "@/lib/dissect/engine";

/**
 * POST /api/care/agent/conversations/[id]/dissect/ask
 *
 * The "Ask Coach" follow-up for Dissect-in-C.A.R.E (founder 2026-07-21) — parity with the
 * standalone Dissect a Conversation, so the agent can INTERROGATE the diagnosis, not just
 * read it. Same engine as /api/dissect/ask-coach (§A16 reuse), with two C.A.R.E differences:
 *   1. Agent-authed (requireCareAgent), not the public-page auth.
 *   2. The source conversation is derived SERVER-SIDE from the support thread each turn (the
 *      agent never pastes) — so the coach always sees the latest messages.
 *
 * Obeys §3.3 (guide-don't-overtake): if the agent hasn't shared how THEY'd solve it, the
 * coach asks what they think before asserting; once they have, it builds on their thinking
 * with the WHY. Grounded in the actual thread (§3.4 — no fabrication). EPHEMERAL — the panel
 * passes prior turns back each call; nothing is persisted. controlExempt like the standalone
 * (this is on-demand diagnosis of a specific case, not the System guiding the team's own work).
 */

const Body = z.object({
  question: z.string().min(2).max(2000),
  /** The agent's own read of how to solve it, if offered (§3.3). */
  userHypothesis: z.string().max(4000).optional(),
  /** The diagnosed problem statement, echoed from the panel's dissect result. */
  problemStatement: z.string().max(1000).optional(),
  /** Prior turns of THIS ephemeral thread so the coach has memory (single-shot LLM). */
  history: z
    .array(
      z.object({
        role: z.enum(["user", "coach"]),
        text: z.string().max(6000),
      })
    )
    .max(40)
    .optional(),
});

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "care-dissect-ask",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  if (!auth.companyId || detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Source text = the visible thread, derived fresh (same shape as the dissect route).
  const sourceText = detail.messages
    .filter((m) => !m.isInternalNote)
    .map((m) => {
      const role =
        m.authorType === "customer"
          ? "Customer"
          : m.authorType === "agent"
            ? "Agent"
            : m.authorType === "ai"
              ? "AI"
              : "System";
      return `${role}: ${m.body}`;
    })
    .join("\n");

  const userHypothesis = (body.userHypothesis ?? "").trim();
  const history = body.history ?? [];
  const userHasSharedTheirThinking = userHasSharedThinking({
    hypothesis: userHypothesis,
    history,
  });

  const systemPrompt = askCoachSystemPrompt({
    sourceText,
    problemStatement: body.problemStatement?.trim() || null,
    userHasSharedTheirThinking,
  });
  const userMessage = buildCoachUserMessage({
    history,
    hypothesis: userHypothesis,
    question: body.question,
  });

  let reply: string;
  try {
    const r = await generateCareReply({
      companyId: detail.conversation.companyId,
      systemPrompt,
      userMessage,
      controlExempt: true,
    });
    reply = r.text;
  } catch {
    return NextResponse.json(
      { error: "The coach could not respond just now. Please try again." },
      { status: 502 }
    );
  }

  if (!reply || !reply.trim()) {
    return NextResponse.json(
      { error: "The coach could not respond just now. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ reply });
}
