/**
 * Decision-dialogue phase pre-conditions — the guide-don't-overtake gate.
 *
 * The in-thread decision dialogue (`chat_topic_decisions`) is a progressive phase
 * machine: situation → elicit → respond → decide → decided. Its columns are nullable
 * by necessity (the row exists before the user has answered), so the "user diagnoses
 * BEFORE the System asserts" ordering is NOT enforced by a NOT NULL column the way the
 * off-thread `decision_dialogues` table enforces it. These predicates ARE that
 * enforcement for the chat-thread path — the System may not generate its response
 * until the user has supplied a non-empty situation, diagnosis, AND proposal.
 *
 * Extracted from the two routes that were each inlining the check
 * (`[id]/respond` and the `[id]` PATCH phase-transition guard) so the one gate has one
 * definition and one test. Behavior-identical to the previous inline expressions:
 * a field counts as "supplied" iff it is a non-empty string after `.trim()`.
 *
 * Note the layered defense: the schema's `decide` fn coalesces a null diagnosis/proposal
 * to '' when writing the finalized `decision_dialogues` record, so the NOT NULL there is
 * satisfied by empty string — meaning THIS predicate (at the API layer), not the schema,
 * is the real "user before System" gate for dialogues that originate in a chat thread.
 */

/** Draft state of a decision dialogue row (only the phase-gating fields). */
export interface DecisionDialogueDraft {
  situation?: string | null;
  userDiagnosis?: string | null;
  userProposal?: string | null;
}

/** True iff the situation has been stated (non-empty after trim). Gates situation → elicit. */
export function hasSituation(d: DecisionDialogueDraft): boolean {
  return Boolean(d.situation?.trim());
}

/**
 * True iff BOTH the user's diagnosis and proposal are supplied (non-empty after trim).
 * Gates elicit → respond: the user must own their read before the System responds.
 */
export function hasUserDiagnosisAndProposal(d: DecisionDialogueDraft): boolean {
  return Boolean(d.userDiagnosis?.trim() && d.userProposal?.trim());
}

/**
 * True iff the dialogue is ready for the System to generate its response — situation,
 * diagnosis, and proposal all supplied. This is the full pre-condition the `/respond`
 * route enforces so a direct caller cannot slip an empty dialogue past the System.
 */
export function readyForSystemResponse(d: DecisionDialogueDraft): boolean {
  return hasSituation(d) && hasUserDiagnosisAndProposal(d);
}
