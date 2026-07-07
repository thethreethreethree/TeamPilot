/**
 * Shared data-contract types for Dissect a Conversation.
 *
 * Framework-agnostic (no `server-only`), so BOTH the server engine and the client
 * page import the SAME shapes (§A13 author-once / §A14 the data contract is an
 * interface — a drifted re-declaration would silently break saved-topic rendering).
 */

export type DissectEvidence = { observation: string; excerpt: string };
export type DissectAngle = { angle: string; why: string };

export type ConversationDissect = {
  hasSignal: boolean;
  /** Plain summary of the pasted conversation. */
  summary: string;
  /** The core problem present in the context, and why it matters. */
  problem: { statement: string; whyItMatters: string };
  /** Signals from the record (§1.2/§3.2) — observation + the quoted excerpt. */
  evidence: DissectEvidence[];
  /** Why the problem exists (§0) — root cause, not symptom. */
  rootCause: string;
  /** How a detached observer would see it (§1.3). */
  outsideView: string;
  /** Angles to CONSIDER — not prescriptions (§3.3 don't overtake). */
  anglesToConsider: DissectAngle[];
  /** Invites the user to render the verdict (§3.3 / A11). */
  guidingQuestion: string;
};

export type CoachTurn = { role: "user" | "coach"; text: string };
