import "server-only";
import { generateCareReply } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/constants";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { coerceJsonText } from "@/lib/llm/coerceJson";
import { methodologyBlock } from "@/lib/coach/v5/salesReviewPrompt";

/**
 * Text-in SALES formulate for the Sales Coach browser extension ("say it for me").
 *
 * Distinct from co-pilot: co-pilot decides WHAT to say from the conversation; formulate takes what the rep
 * ALREADY wants to convey (their intent) and shapes it into a sales-effective message. Text-in
 * ({conversation, intent}) → {reply, reasoning}. Grounds in the shared sales `methodologyBlock`, reuses
 * `generateCareReply` + the `CONVERSATION_IS_DATA` fence. It SHAPES the rep's intent — it phrases it well,
 * it does not render a verdict on it (mirror, not judgement).
 *
 * Does NOT catch — an LlmError propagates so the route maps rate-limit → 429 / other → 502. §3.4: it phrases
 * the rep's own intent well; it never invents a product claim, price, or commitment beyond the intent + the
 * conversation.
 */

/**
 * The formulate system prompt: shared sales methodology + WHO-IS-WHO anchor + the injection fence. Pure +
 * exported so the grounding, anchor, and fence are unit-tested directly.
 */
export function salesFormulateSystemPrompt(repName?: string): string {
  const name = repName?.trim() || "the sales rep";
  return `You are helping a sales rep say something they already know they want to say, but say it WELL — clear, warm, and sales-effective. You are given the conversation so far and the rep's INTENT (what they want to get across). Shape the intent into the rep's next message to the prospect. You are shaping their intent, NOT judging it.

${methodologyBlock()}

You are shaping the message AS: ${name}. In the conversation, messages from ${name} are the rep's own words — continue ${name}'s side; never address the message to ${name}.

Return STRICT JSON, no prose outside it:
{ "reply": "the shaped message the rep can send", "reasoning": "one short line naming the sales move you used to phrase it" }

GROUNDING (§3.4, non-negotiable): phrase the rep's OWN intent. Never invent a product capability, a price, a discount, a statistic, or a commitment that is not in the rep's intent or the conversation. If the intent is unclear, shape the best faithful version rather than inventing a new claim.${CONVERSATION_IS_DATA}`;
}

/**
 * Parse the formulate output into {reply, reasoning}. Exported for tests. Uses coerceJsonText to survive a
 * ```json fence / preamble; falls back to the raw text as the reply (never errors the rep out over
 * formatting), which the route then guards for emptiness.
 */
export function parseFormulateReply(rawText: string): { reply: string; reasoning: string } {
  try {
    const parsed = JSON.parse(coerceJsonText(rawText)) as { reply?: unknown; reasoning?: unknown };
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply.trim() : "",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
    };
  } catch {
    return { reply: rawText.trim(), reasoning: "" };
  }
}

/**
 * Shape the rep's intent into a sendable sales message. Returns {reply, reasoning}. Does NOT catch — an
 * LlmError propagates so the route maps rate-limit → 429 / other → 502. companyId is for LLM cost/routing.
 */
export async function generateSalesFormulate(args: {
  companyId?: string;
  conversation: string;
  intent: string;
  repName?: string;
}): Promise<{ reply: string; reasoning: string }> {
  const r = await generateCareReply({
    companyId: args.companyId,
    systemPrompt: salesFormulateSystemPrompt(args.repName),
    userMessage: `Conversation so far:\n${args.conversation.slice(0, MAX_SOURCE_CHARS)}\n\nThe rep's intent (what they want to get across):\n${args.intent.slice(0, 2_000)}\n\nShape the rep's intent into their next message. Return STRICT JSON.`,
  });
  return parseFormulateReply(r.text);
}
