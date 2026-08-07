import "server-only";
import { generateCareReply } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/constants";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";

/**
 * Text-in SALES summary for the Sales Coach browser extension ("catch me up").
 *
 * A rep re-opening a prospect thread wants a fast, honest read of where the deal stands before they reply.
 * Text-in (conversation) → a short prose summary. Reuses the generic text-out LLM (`generateCareReply`) and
 * the `CONVERSATION_IS_DATA` injection fence, sales-framed.
 *
 * Unlike the dissect/coach engines (which swallow to honest-empty), this DOES NOT catch — it lets an
 * `LlmError` propagate so the route can map a provider rate-limit to 429 and any other failure to 502. That
 * is deliberate: an empty summary would dishonestly read as "nothing to summarize" (§3.4), so a failure must
 * surface as an error, not as false silence — the same posture as the C.A.R.E extension summarize route.
 */

/**
 * The sales-summary system prompt: sales framing + a WHO-IS-WHO anchor when the rep is known + the injection
 * fence. Pure + exported so the framing + fence are unit-tested directly (the engine calls the LLM).
 */
export function salesSummarySystemPrompt(repName?: string): string {
  const who = repName
    ? `\n\nWHO IS WHO: ${repName} is the SALES REP; the other participant is the prospect. Attribute who said what on that basis — do not swap the roles.`
    : "";
  return `You are catching a sales rep up on a conversation with a prospect before they re-engage. Write a short, honest summary (3-5 sentences) of where the deal stands:
- what the prospect wants or is stuck on,
- what has already been offered or discussed,
- the objection or hesitation, if any,
- what is still open and the likely next step.

Ground every point in the thread below. Never invent a commitment, a price, or an agreement the prospect did not actually make (§3.4). If the thread is too thin to summarize fairly, say so plainly in one line rather than inventing a deal state.${who}
${CONVERSATION_IS_DATA}`;
}

/**
 * Summarize a pasted SALES conversation. Returns the summary text. Does NOT catch — an LlmError propagates
 * so the route maps rate-limit → 429, other failures → 502 (an empty string would be a dishonest "nothing
 * to summarize", §3.4). companyId is passed for LLM cost/routing context only.
 */
export async function generateSalesSummary(args: {
  companyId?: string;
  conversation: string;
  repName?: string;
}): Promise<string> {
  const r = await generateCareReply({
    companyId: args.companyId,
    systemPrompt: salesSummarySystemPrompt(args.repName),
    userMessage: `Conversation:\n${args.conversation.slice(0, MAX_SOURCE_CHARS)}\n\nWrite the summary.`,
  });
  return r.text.trim();
}
