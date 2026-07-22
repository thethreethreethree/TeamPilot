import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  resolveCareTenant,
  getProductContextForTenant,
  getCareTenantConfigByCompanyId,
} from "@/lib/care/config";
import {
  buildCareSystemPrompt,
  buildCareUserMessage,
  detectHandoffSignal,
  stripHandoffSentinel,
} from "@/lib/care/prompt";
import { generateCareReply } from "@/lib/claude";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/demo/ask — the REAL Jeff engine, for the public /care/demo "Talk to Jeff" panel.
 *
 * Founder directive (2026-07-22): the inline demo Jeff was scripted/canned; wire it to the same AI
 * response system the real widget uses so a prospect gets a genuine answer. This runs the EXACT
 * production path — buildCareSystemPrompt (ELOSTATE product context + agent name/tone/length) +
 * buildCareUserMessage + generateCareReply — scoped to the ELOSTATE default tenant.
 *
 * It is deliberately STATELESS and PERSISTENCE-FREE (no conversation rows, no auth): a marketing
 * demo doesn't need the inbox/handoff machinery, and not persisting keeps anonymous demo chatter out
 * of the real Care data. The client passes the short recent history back each turn.
 *
 * Because it is public + unauthenticated, it is HARD rate-limited (per client) to cap LLM cost/abuse,
 * input is length-bounded, and history is capped. On any LLM failure it soft-fails to a warm handoff
 * line rather than 500ing — same honesty posture as the real messages route.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AskSchema = z
  .object({
    message: z.string().min(1).max(1000),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(2000),
        })
      )
      .max(12)
      .optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  // Public endpoint → cap cost/abuse: 8 messages / minute per client, 40 / 10 min.
  const perMin = rateLimit(req, { id: "care-demo-ask", windowMs: 60_000, max: 8 });
  if (perMin) return perMin;
  const perTenMin = rateLimit(req, { id: "care-demo-ask-10m", windowMs: 600_000, max: 40 });
  if (perTenMin) return perTenMin;

  const body = await readBody(req, AskSchema);
  if (body instanceof NextResponse) return body;

  const companyId = resolveCareTenant(); // ELOSTATE default tenant
  const productContext = await getProductContextForTenant(companyId);
  const tenant = await getCareTenantConfigByCompanyId(companyId);

  const systemPrompt = buildCareSystemPrompt({
    productContext,
    agentName: tenant?.aiName,
    aiTone: tenant?.aiTone,
    aiResponseLength: tenant?.aiResponseLength,
  });

  const recentTurns = (body.history ?? []).map((t) => ({
    role: (t.role === "assistant" ? "ai" : "customer") as "ai" | "customer",
    body: t.content,
  }));

  const userMessage = buildCareUserMessage({
    newMessage: body.message,
    context: { productContext, recentTurns },
  });

  try {
    const r = await generateCareReply({ systemPrompt, userMessage });
    // Same handoff handling as the real messages route: Jeff appends [[HANDOFF]] when it hands off to
    // a human (billing/account actions). Detect it, then STRIP the sentinel before the customer sees it.
    const handoff = detectHandoffSignal(r.text);
    const reply = stripHandoffSentinel(r.text).trim();
    return NextResponse.json({
      reply: reply || "Let me connect you with a teammate who can help with that.",
      handoff,
    });
  } catch (err) {
    // Soft-fail (same posture as the real messages route): never 500 in the customer's face.
    // eslint-disable-next-line no-console
    console.error(
      "[care.demo.ask] AI reply failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    const reason =
      err instanceof LlmError
        ? "I'm having trouble reaching my brain for a second."
        : "Something hiccuped on my end.";
    return NextResponse.json({
      reply: `${reason} A real person on the ELOSTATE team can pick this up — book a quick demo and we'll walk you through it live.`,
      handoff: true,
    });
  }
}
