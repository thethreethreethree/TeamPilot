import "server-only";
import { generateCareReply } from "@/lib/claude";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/constants";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { methodologyBlock } from "@/lib/coach/v5/salesReviewPrompt";
import { copilotModeInstruction, type LastSpeaker } from "@/lib/care/copilotMode";

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

export const REASONING_MARKER = "===REASONING===";

/**
 * Split the model output into the drafted reply and its one-line move-naming reasoning. Pure + exported so
 * the split (and the marker-first / no-marker edge cases) is unit-tested directly.
 */
export function splitReplyReasoning(raw: string): { reply: string; reasoning: string } {
  const idx = raw.indexOf(REASONING_MARKER);
  const reply = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const reasoning = idx >= 0 ? raw.slice(idx + REASONING_MARKER.length).trim() : "";
  return { reply, reasoning };
}

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

Then, on a new line, output the marker ${REASONING_MARKER} followed by ONE short line naming the sales MOVE you used (e.g. "labeled the objection", "asked a SPIN implication question", "traded a small concession for a commitment") — for the rep's learning, not for the prospect.

GROUNDING (§3.4, non-negotiable): draft only from what the conversation supports. Never invent a product capability, a price, a discount, a statistic, or a commitment the rep has not actually made. If the conversation is too thin to draft responsibly, say so in the reply rather than inventing a pitch.${CONVERSATION_IS_DATA}`;
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
  const repName = args.repName?.trim() || "the sales rep";
  const r = await generateCareReply({
    companyId: args.companyId,
    systemPrompt: salesCopilotSystemPrompt({ repName, lastSpeaker: args.lastSpeaker }),
    userMessage: `Conversation so far:\n${args.conversation.slice(0, MAX_SOURCE_CHARS)}\n\nDraft ${repName}'s next message to the prospect, following the RESPONSE MODE above, then the ${REASONING_MARKER} line.`,
  });
  return splitReplyReasoning(r.text);
}
