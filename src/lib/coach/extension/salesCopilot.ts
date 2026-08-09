import "server-only";
import { generateCareReply } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/constants";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { methodologyBlock } from "@/lib/coach/v5/salesReviewPrompt";
import { copilotModeInstruction, type LastSpeaker } from "@/lib/care/copilotMode";
import {
  REASONING_MARKER,
  splitReplyReasoning,
  finalizeSuggestion,
  salesVoiceRule,
} from "@/lib/coach/extension/salesSuggestFormat";

/**
 * Text-in SALES co-pilot for the Sales Coach browser extension ("draft my reply").
 *
 * The rep, mid-conversation with a prospect, wants a drafted next message + the NAME of the sales move it
 * used (for their learning). Text-in ({conversation, lastSpeaker?}) → {reply, reasoning}. Reuses the generic
 * text-out LLM (`generateCareReply`), the shared sales `methodologyBlock`, the `CONVERSATION_IS_DATA` fence,
 * and — crucially — the SAME reply-vs-follow-up mode selector (`copilotModeInstruction`) the C.A.R.E co-pilot
 * uses, so an agent-last thread produces a follow-up, not a reply to the rep's own words. One mechanism, not
 * a fork (§A21).
 *
 * CONTROL-WINDOW: like the C.A.R.E co-pilot/summarize/dissect, this acts on the rep's EXTERNAL conversation
 * (not the team's internal event chain), so it is intentionally NOT gated by the month-1 control window
 * (A3). EPHEMERAL — nothing stored.
 *
 * Does NOT catch — an LlmError propagates so the route maps rate-limit → 429 / other → 502 (a blank draft is
 * an error, not a silent empty). §3.4: the draft never invents a product claim, price, or commitment that is
 * not in the conversation.
 */

// REASONING_MARKER + splitReplyReasoning now live in the shared salesSuggestFormat module (§A21) so the
// streaming reader and both engines split output identically. Re-exported here for existing importers.
export { REASONING_MARKER, splitReplyReasoning };

/**
 * The sales co-pilot system prompt: the shared sales methodology + WHO-IS-WHO anchor + the reply/follow-up
 * mode instruction + the injection fence. Pure + exported so the grounding, anchor, mode, and fence are
 * tested directly (the engine calls the LLM).
 */
export function salesCopilotSystemPrompt(args: {
  repName?: string;
  lastSpeaker?: LastSpeaker;
}): string {
  const repName = args.repName?.trim() || "the sales rep";
  return `You are a sales rep's co-pilot. Draft the rep's NEXT message to the prospect, in the rep's voice.

${methodologyBlock()}

You are drafting AS: ${repName}. Messages from ${repName} in the conversation are the rep's own words — write the next message from ${repName}'s side, never addressed to ${repName}.

${copilotModeInstruction(args.lastSpeaker ?? "unknown", repName)}

${salesVoiceRule()}

Then, on a new line, output the marker ${REASONING_MARKER} followed by ONE short line naming the sales MOVE you used (e.g. "labeled the objection", "asked a SPIN implication question", "traded a small concession for a commitment") — for the rep's learning, not for the prospect.

GROUNDING (§3.4, non-negotiable): draft only from what the conversation supports. Never invent a product capability, a price, a discount, a statistic, or a commitment the rep has not actually made. If the conversation is too thin to draft responsibly, say so in the reply rather than inventing a pitch.${CONVERSATION_IS_DATA}`;
}

/**
 * Build the co-pilot {systemPrompt, userMessage} pair. Exported so BOTH the non-streaming engine below and the
 * streaming route (/suggest with stream:true) assemble the request from ONE place — the prompt can't drift
 * between the two surfaces (§A21). Pure; no LLM call.
 */
export function buildSalesCopilotRequest(args: {
  conversation: string;
  repName?: string;
  lastSpeaker?: LastSpeaker;
}): { systemPrompt: string; userMessage: string } {
  const repName = args.repName?.trim() || "the sales rep";
  return {
    systemPrompt: salesCopilotSystemPrompt({ repName, lastSpeaker: args.lastSpeaker }),
    userMessage: `Conversation so far:\n${args.conversation.slice(0, MAX_SOURCE_CHARS)}\n\nDraft ${repName}'s next message to the prospect, following the RESPONSE MODE above, then the ${REASONING_MARKER} line.`,
  };
}

/**
 * Draft the rep's next message + name the move. Returns {reply, reasoning}. Does NOT catch — an LlmError
 * propagates so the route maps rate-limit → 429 / other → 502. companyId is for LLM cost/routing only.
 */
export async function generateSalesCopilotReply(args: {
  companyId?: string;
  conversation: string;
  repName?: string;
  lastSpeaker?: LastSpeaker;
}): Promise<{ reply: string; reasoning: string }> {
  const { systemPrompt, userMessage } = buildSalesCopilotRequest(args);
  // controlExempt: the Sales Coach runs DAY-1 (founder decision) — like salesReview/salesSummary/ask-coach,
  // and because this acts on the rep's EXTERNAL conversation, not the team's internal month-1 baseline. Without
  // it, a customer in their month-1 control window got an empty 502 instead of a draft (review Finding, Area 3).
  const r = await generateCareReply({ companyId: args.companyId, systemPrompt, userMessage, controlExempt: true });
  return finalizeSuggestion(r.text);
}
