/**
 * Co-Pilot response-MODE selector (founder request 2026-07-23).
 *
 * THE PROBLEM (why this exists — CLAUDE.md §2 / Thinkx1 Rule 1): the Co-Pilot always drafted a
 * *reply*, assuming the last message in the thread was the customer's. When the last message is
 * actually the AGENT's own (the sender), replying makes it respond to the agent's own words and
 * mis-assign roles ("assumes the sender is the receiver"). The 2b agent-name anchor fixed WHO is
 * who; it did NOT fix the response STRUCTURE when the agent spoke last.
 *
 * THE FIX: branch the response mode on who spoke last:
 *   - customer spoke last → REPLY to their message (unchanged behaviour).
 *   - agent (sender) spoke last → FOLLOW-UP: a continuation of the agent's side (a polite nudge /
 *     check-in / added context), NEVER a reply to the agent's own message.
 *   - unknown (unlabeled channel / manual selection / no adapter signal) → the model determines it
 *     and DEFAULTS TO REPLY, so this change can never regress today's behaviour (§1.5 don't break
 *     what works).
 *
 * This is the pure decision core (CLAUDE.md §1.5.1 Layer 1) so the mode logic is unit-testable even
 * though the DOM signal that feeds `lastSpeaker` is browser-only. It COMPOSES with the 2b anchor
 * (TT.md A16): the returned block references the same `{agentName}` the anchor establishes.
 */
export type LastSpeaker = "agent" | "customer" | "unknown";

export function copilotModeInstruction(
  lastSpeaker: LastSpeaker,
  agentName: string
): string {
  if (lastSpeaker === "agent") {
    return `RESPONSE MODE — FOLLOW-UP. The LAST message in the thread is from ${agentName} (you, the agent), and the customer has NOT replied since. Do NOT respond to your own message. Draft a natural FOLLOW-UP that continues ${agentName}'s side of the conversation — for example a brief, polite check-in, a gentle nudge, or added helpful context that moves things forward from what ${agentName} last said. It must read as ${agentName} following up with the customer, never as a reply to ${agentName}'s own words.`;
  }
  if (lastSpeaker === "customer") {
    return `RESPONSE MODE — REPLY. The last message in the thread is from the customer. Reply directly to what the customer said, written as ${agentName}.`;
  }
  return `RESPONSE MODE — DETERMINE FIRST. Work out who sent the LAST message in the thread. If it is from ${agentName} (you, the agent) and the customer has not since replied, draft a FOLLOW-UP that continues ${agentName}'s side (a brief, polite check-in or nudge), NOT a reply to your own message. If the last message is from the customer, reply directly to it as ${agentName}. If you genuinely cannot tell who spoke last, default to replying to the most recent customer message.`;
}
