/**
 * Push-notification recipient derivation for a chat topic (pure, so the
 * 2026-07-16 delivery fix is unit-testable and can't silently regress).
 *
 * A recipient is anyone ENGAGED with the topic — they either SENT a message OR are
 * an active explicit PARTICIPANT — MINUS the sender (you don't push someone their
 * own message). The participant half is the fix: before it, a user ADDED to a topic
 * who hadn't yet sent a message (the recipient of a first message) got no push at
 * all, which read as "subscribes but doesn't deliver". Reverting to authors-only
 * would drop that person again — this function exists so a test catches that.
 */
export function deriveNotifyRecipients(args: {
  /** Distinct-ish author ids from recent messages (may contain nulls). */
  authorIds: (string | null | undefined)[];
  /** Active explicit participant ids (may contain nulls). */
  participantIds: (string | null | undefined)[];
  /** The message sender — always excluded. */
  senderId: string;
}): string[] {
  const engaged = new Set<string>();
  for (const id of args.authorIds) if (id) engaged.add(id);
  for (const id of args.participantIds) if (id) engaged.add(id);
  engaged.delete(args.senderId); // never notify the sender of their own message
  return Array.from(engaged);
}
