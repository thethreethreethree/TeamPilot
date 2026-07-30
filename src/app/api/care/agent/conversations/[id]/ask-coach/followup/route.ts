import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { fetchAgentConversation } from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { followUpCoachV5 } from "@/lib/claude";
import {
  buildFollowUpSystemPrompt,
  buildFollowUpUserMessage,
} from "@/lib/coach/v5/prompt";
import { LlmError } from "@/lib/llm/errors";
import type { CoachFollowUpResponse } from "@/lib/coach/v5/types";

/**
 * POST /api/care/agent/conversations/[id]/ask-coach/followup
 *
 * Sibling to /api/coach/v5/followup but scoped to a C.A.R.E
 * conversation. Same backend, same response shape — the only
 * thing this route adds is resolving the support context
 * server-side from the conversation_id (recent thread,
 * customer last message, product context) so the client
 * doesn't have to ship it.
 *
 * Per TT.md A21 — C.A.R.E "Ask Coach" conversational depth
 * must match ELOSTATE's. The user's follow-up question
 * (free-form input or a "You could ask me" chip) routes here.
 */

const Body = z.object({
  draft: z.string().min(1).max(8000),
  priorTurns: z
    .array(
      z.object({
        role: z.enum(["user", "coach"]),
        content: z.string().min(1).max(4000),
      })
    )
    .max(20),
  userQuestion: z.string().min(1).max(2000),
});

function validateFollowUpResponse(
  parsed: unknown
): CoachFollowUpResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (
    typeof r.reply !== "string" ||
    r.reply.length === 0 ||
    r.reply.length > 4000
  ) {
    return null;
  }
  const starters = r.conversationStarters;
  if (
    !Array.isArray(starters) ||
    starters.some((s) => typeof s !== "string" || s.length > 400)
  ) {
    return null;
  }
  const out: CoachFollowUpResponse = {
    reply: r.reply,
    conversationStarters: starters.slice(0, 3) as string[],
  };
  if (
    typeof r.alternativeRevision === "string" &&
    r.alternativeRevision.length > 0 &&
    r.alternativeRevision.length <= 4000
  ) {
    out.alternativeRevision = r.alternativeRevision;
  }
  return out;
}

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Unmetered LLM endpoint (audit 2026-07-06, A13/A21). Followup is chattier,
  // so a slightly higher cap than the one-shot routes.
  const limited = rateLimit(req, {
    id: "care-ask-coach-followup",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

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
  if (!auth.companyId || detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  const visible = detail.messages
    .filter((m) => !m.isInternalNote)
    .slice(-12);
  const customerLast = [...visible]
    .reverse()
    .find((m) => m.authorType === "customer");
  if (!customerLast) {
    return NextResponse.json(
      { error: "No customer message in context." },
      { status: 400 }
    );
  }
  const recentThread = visible.map((m) => ({
    author:
      m.authorType === "customer"
        ? "Customer"
        : m.authorType === "agent"
          ? "Agent (earlier)"
          : m.authorType === "ai"
            ? "AI (earlier)"
            : "System",
    body: m.body,
    timestamp: m.createdAt ?? "",
  }));
  const productContext = await getProductContextForTenant(
    detail.conversation.companyId
  );

  try {
    const systemPrompt = buildFollowUpSystemPrompt({
      contextType: "support_reply",
    });
    const userMessage = buildFollowUpUserMessage({
      draft: body.draft,
      contextType: "support_reply",
      contextPayload: {
        recentThread,
        supportCustomerLastMessage: {
          author: "Customer",
          body: customerLast.body,
        },
        supportProductContext: productContext,
      },
      priorTurns: body.priorTurns,
      userQuestion: body.userQuestion,
    });

    const r = await followUpCoachV5({
      companyId: auth.companyId ?? undefined,
      systemPrompt,
      userMessage,
    });

    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason },
        { status: 200 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(r.text);
    } catch {
      return NextResponse.json(
        {
          error: "Coach returned malformed response. Please try again.",
          code: "malformed_response",
        },
        { status: 502 }
      );
    }

    const validated = validateFollowUpResponse(parsed);
    if (!validated) {
      return NextResponse.json(
        {
          error: "Coach returned an invalid response shape. Please try again.",
          code: "invalid_response_shape",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      response: validated,
      provider: r.provider,
      model: r.model,
    });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    console.error("[care/ask-coach/followup] non-LLM failure:", err);
    return NextResponse.json(
      { error: "Couldn't reach the coach." },
      { status: 500 }
    );
  }
}
