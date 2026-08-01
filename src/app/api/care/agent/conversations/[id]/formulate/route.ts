import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { fetchAgentConversation } from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { coerceJsonText } from "@/lib/llm/coerceJson";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { SERVICE_PHILOSOPHY } from "@/lib/care/servicePhilosophy";

/**
 * POST /api/care/agent/conversations/[id]/formulate
 *
 * "Help me formulate" — when the agent isn't sure what to say or
 * how to structure a reply, this endpoint:
 *   1. Reads the conversation context
 *   2. Takes the agent's intent (one or two sentences of what they
 *      WANT to communicate) and any constraints
 *   3. Drafts a customer-facing reply that turns the intent into
 *      a clear, warm message in the C.A.R.E voice
 *
 * Different from AI Co-Pilot:
 *   - Co-Pilot drafts unprompted ("here's what I'd say if I were
 *     you") and is best when the agent has no draft and trusts
 *     the System to lead.
 *   - Help me formulate takes the AGENT'S idea and shapes it.
 *     Agent stays in the driver's seat — System is the editor.
 *
 * Per §A11 the System is shaping the agent's draft from their
 * stated intent, not rendering a verdict on it. Per §A8 the
 * voice is growth-participant: helping the agent get the message
 * out the way they meant it.
 */
const SYSTEM = `You are helping a customer support agent shape a reply. The agent has told you what they WANT to communicate (their intent); your job is to turn that intent into a clear, warm message in the C.A.R.E voice.

C.A.R.E voice rules (non-negotiable):
  - Plain prose, no bullets unless the customer asked for steps
  - 1-4 sentences typical
  - Acknowledge briefly, answer (or honestly hand off), end with a clear next step
  - No corporate filler ("we appreciate your patience" etc.)
  - Match the customer's energy

Critical: do NOT invent product details. If the agent's intent references something not in the product context, keep the reply general enough that it doesn't fabricate specifics.

If the agent's intent is unclear or too vague to act on, return a reply that asks the customer a clarifying question — don't fake confidence.

Output format: return STRICT JSON, no markdown, no commentary:
{
  "draft": "<the drafted reply, plain prose>",
  "reasoning": "<1 sentence for the agent — what move you made shaping their intent>"
}`;

const Body = z.object({
  intent: z.string().min(1).max(2000),
});

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Unmetered LLM endpoint (audit 2026-07-06, A13/A21). Per-agent cap.
  const limited = rateLimit(req, {
    id: "care-formulate",
    windowMs: 60_000,
    max: 20,
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

  const turns = visible
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

  const userMessage = [
    `Product context the agent is grounded in:\n${productContext}`,
    turns ? `Conversation so far:\n${turns}` : null,
    customerLast
      ? `Customer's most recent message:\n${customerLast.body}`
      : null,
    `Agent's intent (what they want to communicate):\n${body.intent}`,
    `Shape the agent's intent into a reply. Return STRICT JSON.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    // §3.4 + TT.md A21: route through Brain (pass companyId)
    // so the §3.4 control window applies — during month-1 the
    // System refuses to speak so the team's baseline behavior
    // is captured honestly. Without this, C.A.R.E would always
    // formulate regardless of control state, breaking the
    // "honesty is the moat" rule.
    const r = await generateCareReply({
      companyId: detail.conversation.companyId,
      // Fence the customer conversation as untrusted data (§A26 class sweep — same as the extension tools).
      systemPrompt: SYSTEM + SERVICE_PHILOSOPHY + CONVERSATION_IS_DATA,
      userMessage,
    });
    if (r.suppressed) {
      return NextResponse.json(
        {
          suppressed: true,
          reason: r.reason,
          message:
            "Formulate is in §3.4 control window — type your own draft and the System will learn from it.",
        },
        { status: 200 }
      );
    }
    let parsed: { draft?: string; reasoning?: string };
    try {
      // This route needs {draft, reasoning} JSON but reuses generateCareReply (expectJson:false, a PROSE
      // helper) for its month-1 control-window gating — so it gets neither DeepSeek's json_object mode nor
      // llmCall's expectJson coercion. Without coerceJsonText a fenced/prose reply (esp. on the Anthropic
      // failover) would 502 "Couldn't parse" even though valid JSON is right there. Extract it explicitly.
      parsed = JSON.parse(coerceJsonText(r.text));
    } catch {
      return NextResponse.json(
        { error: "Couldn't parse the formulate response." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      draft: (parsed.draft ?? "").trim(),
      reasoning: (parsed.reasoning ?? "").trim(),
    });
  } catch (err) {
    // Surface the REAL provider cause (2026-07-25 class sweep) instead of a
    // generic 502 the operator can't diagnose.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[care.formulate] generation failed:", detail, err);
    return NextResponse.json(
      { error: "Couldn't formulate right now.", detail },
      { status: 502 }
    );
  }
}
