import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { fetchAgentConversation } from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { analyzeCoachV5 } from "@/lib/claude";
import { buildSystemPrompt, buildUserMessage } from "@/lib/coach/v5/prompt";
import { loadCoachMemory, renderMemoryForPrompt } from "@/lib/coach/v5/memory";
import { LlmError } from "@/lib/llm/errors";
import type {
  CoachAnalysisResponse,
  CoachClassification,
} from "@/lib/coach/v5/types";

/**
 * POST /api/care/agent/conversations/[id]/ask-coach
 *
 * Per TT.md A21 (2026-06-18) — the C.A.R.E "Ask Coach" feature
 * MUST behave identically to the ELOSTATE chat-side "Ask Coach"
 * (CoachPanelV5). Founder framing: "asked coach is one of the
 * biggest features a customer management chat system can have."
 * Same backend (Coach v5), same response shape, same UI.
 *
 * Differences from /api/coach/v5/analyze:
 *   1. Auth gate is C.A.R.E's requireCareAgent (not the chat
 *      gate). Defense-in-depth company match check applies.
 *   2. The support context payload (customer's most recent
 *      message + product context + thread tail) is resolved
 *      server-side from the conversation_id — the client only
 *      sends the draft + the optional mode override. Less
 *      surface area for tampering and the client doesn't need
 *      product context cached.
 *   3. The contextType is hardcoded to "support_reply" — the
 *      Coach v5 prompt has a dedicated SURFACE CONTEXT NOTE
 *      for it covering customer-facing voice, fabricated-
 *      specifics risk, etc.
 *
 * Compatible response shape: `{ response: CoachAnalysisResponse,
 * provider, model }` or `{ suppressed: true, reason }` — exactly
 * what CoachPanelV5 already consumes. The same panel renders.
 */

const Body = z.object({
  draft: z.string().min(1).max(8000),
  mode: z.enum(["auto", "ask", "review_sent"]).default("ask"),
});

const VALID_CLASSIFICATIONS = new Set<CoachClassification>([
  "correct",
  "unclear",
  "unproductive",
  "negative",
]);

function validateResponse(parsed: unknown): CoachAnalysisResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (
    typeof r.classification !== "string" ||
    !VALID_CLASSIFICATIONS.has(r.classification as CoachClassification)
  ) {
    return null;
  }
  if (typeof r.needsImprovement !== "boolean") return null;
  if (!Array.isArray(r.conversationStarters)) return null;
  const starters: string[] = [];
  for (const s of r.conversationStarters) {
    if (typeof s === "string" && s.length > 0 && s.length <= 200) {
      starters.push(s);
    }
  }
  const response: CoachAnalysisResponse = {
    classification: r.classification as CoachClassification,
    needsImprovement: r.needsImprovement,
    conversationStarters: starters.slice(0, 3),
  };
  if (typeof r.affirmation === "string" && r.affirmation.length <= 600) {
    response.affirmation = r.affirmation;
  }
  if (r.needsImprovement) {
    const imp = r.improvement;
    if (typeof imp !== "object" || imp === null) return null;
    const i = imp as Record<string, unknown>;
    if (
      typeof i.suggestedRevision !== "string" ||
      i.suggestedRevision.length === 0 ||
      i.suggestedRevision.length > 4000 ||
      typeof i.whyContext !== "string" ||
      i.whyContext.length === 0 ||
      i.whyContext.length > 800 ||
      typeof i.whySentence !== "string" ||
      i.whySentence.length === 0 ||
      i.whySentence.length > 800
    ) {
      return null;
    }
    const principle = i.principleCited;
    if (typeof principle !== "object" || principle === null) return null;
    const p = principle as Record<string, unknown>;
    if (
      typeof p.name !== "string" ||
      typeof p.book !== "string" ||
      typeof p.sectionRef !== "string"
    ) {
      return null;
    }
    response.improvement = {
      suggestedRevision: i.suggestedRevision,
      whyContext: i.whyContext,
      whySentence: i.whySentence,
      principleCited: {
        name: p.name,
        book: p.book,
        sectionRef: p.sectionRef,
      },
    };
    if (
      typeof i.secondaryPrinciple === "object" &&
      i.secondaryPrinciple !== null
    ) {
      const sp = i.secondaryPrinciple as Record<string, unknown>;
      if (
        typeof sp.name === "string" &&
        typeof sp.book === "string" &&
        typeof sp.sectionRef === "string"
      ) {
        response.improvement.secondaryPrinciple = {
          name: sp.name,
          book: sp.book,
          sectionRef: sp.sectionRef,
        };
      }
    }
  }
  return response;
}

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Rate limit per agent — Coach v5 burns LLM tokens. The mirror
  // route /api/coach/v5/analyze rate-limits at 30/min; matching
  // here so a scripted client can't escape the cost ceiling by
  // routing through the C.A.R.E mirror.
  const limited = rateLimit(req, {
    id: `care-ask-coach:${auth.agentId}`,
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

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

  // Resolve the support context — same shape Coach v5 expects in
  // contextPayload.supportCustomerLastMessage + supportProductContext.
  const visible = detail.messages
    .filter((m) => !m.isInternalNote)
    .slice(-12);
  const customerLast = [...visible]
    .reverse()
    .find((m) => m.authorType === "customer");
  if (!customerLast) {
    return NextResponse.json(
      { error: "No customer message to coach against yet." },
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
    const memory = await loadCoachMemory();
    const memoryBlock = renderMemoryForPrompt(memory);

    const systemPrompt = buildSystemPrompt({
      mode: body.mode,
      contextType: "support_reply",
      memoryBlock,
    });
    const userMessage = buildUserMessage({
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
    });

    const r = await analyzeCoachV5({
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
          error:
            "Coach returned a malformed response. Please try again.",
          code: "malformed_response",
        },
        { status: 502 }
      );
    }

    const validated = validateResponse(parsed);
    if (!validated) {
      return NextResponse.json(
        {
          error:
            "Coach returned an invalid response shape. Please try again.",
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
