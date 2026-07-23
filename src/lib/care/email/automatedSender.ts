/**
 * Detect whether an inbound email came from an AUTOMATED sender that must NOT
 * receive an AI auto-reply — an out-of-office responder, a bounce/daemon
 * mailbox, or bulk/list mail.
 *
 * RFC 3834 §2 is explicit: an automatic responder MUST NOT reply to a message
 * carrying `Auto-Submitted:` with any value other than "no", and should suppress
 * replies to bulk/list mail. Without this guard the C.A.R.E email first-responder
 * would reply to an out-of-office auto-reply, whose server may auto-reply again →
 * a machine ping-pong. The route's count-based loop breaker BOUNDS that ping-pong
 * (it trips after ~5 hops), but this stops it at hop 0: no wasted LLM call, and —
 * once Postmark is live — no unwanted email to a real person's inbox.
 *
 * Conservative by design. It fires ONLY on well-established "do-not-auto-reply"
 * signals, because a false positive SILENCES a real customer. A human's mail
 * client sets none of these. Anything this misses still hits the downstream
 * count-based loop breaker, so the failure mode is "one extra hop", never
 * "a customer never hears back".
 *
 * Pure + structurally typed (no server import) so every branch is unit-tested
 * directly — matching buildRecentTurns / resolveEmailReplyBody (A14).
 */
export interface EmailHeader {
  Name: string;
  Value: string;
}

export interface AutomatedSenderVerdict {
  automated: boolean;
  /**
   * Which signal fired — recorded in the `ai_suppressed_automated` event's
   * metadata so an operator can see WHY the AI stayed quiet (§3.6). Null when
   * the sender looks human.
   */
  reason: string | null;
}

// From-mailboxes that never represent a human awaiting a reply. Matched against
// the local-part only (before the "@"), lower-cased.
const NO_REPLY_LOCALPARTS = new Set([
  "mailer-daemon",
  "postmaster",
  "no-reply",
  "noreply",
  "donotreply",
  "do-not-reply",
  "bounce",
  "bounces",
]);

/** First header value matching `name` (case-insensitive), trimmed; null if absent. */
function headerValue(headers: EmailHeader[], name: string): string | null {
  const lc = name.toLowerCase();
  for (const h of headers) {
    if (h?.Name?.toLowerCase() === lc) return (h.Value ?? "").trim();
  }
  return null;
}

/** Local-part of a bare email address (schema guarantees From is `.email()`), lower-cased. */
function fromLocalPart(from: string): string | null {
  const addr = (from ?? "").trim().toLowerCase();
  const at = addr.indexOf("@");
  if (at <= 0) return null;
  return addr.slice(0, at);
}

// Outlook/Exchange out-of-office subjects. Anchored at the start — a human's subject does not begin
// with these. This is the single most common business auto-reply and it does NOT reliably set
// Auto-Submitted, so without a subject check the detector would miss the majority of real OOO mail.
const OOO_SUBJECT_RE = /^\s*(automatic reply|auto-?reply|out of office autoreply|out of office reply|out of office:)/i;

export function detectAutomatedSender(
  headers: EmailHeader[] | undefined,
  from: string,
  subject?: string
): AutomatedSenderVerdict {
  const hs = headers ?? [];

  // 1. RFC 3834 Auto-Submitted: present with any value other than "no" = automated.
  const autoSubmitted = headerValue(hs, "Auto-Submitted");
  if (autoSubmitted !== null && autoSubmitted.toLowerCase() !== "no") {
    return { automated: true, reason: `auto-submitted:${autoSubmitted.toLowerCase()}` };
  }

  // 2. Exchange/Outlook auto-reply marker. Its PRESENCE (any value — "All", "OOF", …) means the
  //    sender's system flagged this as mail we should not auto-respond to; humans never set it.
  //    Catches the common Exchange OOO that omits Auto-Submitted.
  if (headerValue(hs, "X-Auto-Response-Suppress") !== null) {
    return { automated: true, reason: "x-auto-response-suppress" };
  }

  // 3. Bulk / list / junk mail via Precedence.
  const precedence = headerValue(hs, "Precedence");
  if (precedence && ["bulk", "list", "junk"].includes(precedence.toLowerCase())) {
    return { automated: true, reason: `precedence:${precedence.toLowerCase()}` };
  }

  // 4. Mailing-list markers — a 1:1 human email carries neither.
  if (headerValue(hs, "List-Id") !== null) {
    return { automated: true, reason: "list-id" };
  }
  if (headerValue(hs, "List-Unsubscribe") !== null) {
    return { automated: true, reason: "list-unsubscribe" };
  }

  // 5. Out-of-office SUBJECT prefix (Outlook/Exchange "Automatic reply: …"). The dominant real-world
  //    OOO signal, and the one most likely to arrive without any of the headers above.
  if (subject && OOO_SUBJECT_RE.test(subject)) {
    return { automated: true, reason: "ooo-subject" };
  }

  // 6. Non-monitored From mailbox (mailer-daemon@, no-reply@, …).
  const local = fromLocalPart(from);
  if (local && NO_REPLY_LOCALPARTS.has(local)) {
    return { automated: true, reason: `no-reply-sender:${local}` };
  }

  return { automated: false, reason: null };
}
