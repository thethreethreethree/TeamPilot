/**
 * What the customer actually receives (and gets emailed) for an inbound-email AI turn.
 *
 * The rule this encodes — and locks against regression — is a §3.3 customer-experience guarantee:
 * a HANDOFF must never leave the customer in silence. Extracted from the inbound-email route because
 * the naive version (send only the AI's text) drops to nothing when the AI emits ONLY the [[HANDOFF]]
 * sentinel (empty after strip), which is exactly when the customer most needs to hear "a human is
 * coming."
 *
 * Precedence:
 *   1. A non-empty stripped reply → send it. It already carries the AI's warm hand-off line when
 *      relevant, so we do NOT also append the notice (that would double-email the customer — the one
 *      place email deliberately differs from the widget, where a second system bubble is harmless).
 *   2. Empty reply + handoff → the handoff notice (never silence).
 *   3. Empty reply + no handoff → nothing (the AI had nothing to add and isn't ceding; the next
 *      customer message gets a fresh reply).
 */
export function resolveEmailReplyBody(
  strippedReply: string,
  aiHandsOff: boolean,
  handoffNotice: string
): string {
  return strippedReply || (aiHandsOff ? handoffNotice : "");
}
