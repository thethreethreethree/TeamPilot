/**
 * How a door outcome is worded on screen.
 *
 * THERE ARE TWO OUTCOME VOCABULARIES IN THIS PRODUCT and they barely overlap.
 * A coaching SESSION ends in `sold | follow_up | no_sale | no_contact |
 * undecided` — that is `OUTCOME_LABEL` in `format.ts`. A door PITCH ends in
 * `sold | go_back | non_decision_maker | not_interested | no_answer`. Only
 * `sold` appears in both, and the two maps have the same NAME, so a file that
 * declares its own shadows the import silently.
 *
 * WHY THIS MODULE EXISTS: there were THREE identical copies of the door map —
 * the Door Log, Pitch Performance and the pitch detail each declared their own.
 * All three were correct, which is exactly the state that decays: the next
 * outcome the server adds gets added to one or two of them.
 *
 * AN UNKNOWN OUTCOME IS HUMANISED, NOT PRINTED RAW. If the server adds a value
 * tomorrow a rep should read "Left message", not `left_message`. The web prints
 * the raw value; there is no reason to copy that.
 */
import type { KnockOutcome } from './knock-store';

/** The rep's own words for each outcome. Matches the Door Log's buttons exactly. */
export const PITCH_OUTCOME_LABEL: Record<KnockOutcome, string> = {
  no_answer: 'No answer',
  sold: 'Sold',
  go_back: 'Go back',
  non_decision_maker: 'Not the decision maker',
  not_interested: 'Not interested',
};

export function pitchOutcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return 'Outcome not recorded';
  // The server's own literal for "we do not know", which the three maps this
  // replaced all carried. Humanising it to "Unknown" would be a regression: it
  // reads as a recorded outcome rather than an absent one.
  if (outcome === 'unknown') return 'Outcome not recorded';
  const known = PITCH_OUTCOME_LABEL[outcome as KnockOutcome];
  if (known) return known;
  // Unknown, but still readable: underscores out, first letter up. A rep should
  // never be shown a column value.
  const words = outcome.replace(/_+/g, ' ').trim();
  if (!words) return 'Outcome not recorded';
  return words.charAt(0).toUpperCase() + words.slice(1);
}
