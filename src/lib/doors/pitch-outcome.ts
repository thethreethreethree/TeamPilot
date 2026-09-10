/**
 * The outcomes a RECORDED pitch can end in.
 *
 * NOT THE SAME LIST AS THE DOOR LOG'S. The Door Log offers five, including
 * `no_answer` — because most knocks are nobody home. A recorded pitch cannot
 * have ended in no answer: somebody opened the door and the rep talked to them.
 * The server agrees and enforces it: the door-log route's pitch schema is
 * `z.enum(["sold","go_back","non_decision_maker","not_interested"])`, four
 * values, and sending the fifth is a 400 after the conversation is over.
 *
 * So this is deliberately its own list rather than a filter written at a call
 * site, where the next person would not know why the fifth is missing.
 */
import type { KnockOutcome } from './knock-store';

export type PitchOutcome = Exclude<KnockOutcome, 'no_answer'>;

/** In the order a rep meets them, with Sold given the emphasis it earns. */
export const PITCH_OUTCOMES: { outcome: PitchOutcome; label: string; lead?: boolean }[] = [
  { outcome: 'sold', label: 'Sold', lead: true },
  { outcome: 'go_back', label: 'Go back' },
  { outcome: 'non_decision_maker', label: 'Not the decision maker' },
  { outcome: 'not_interested', label: 'Not interested' },
];

/** True when the server's pitch schema would accept this value. */
export function isPitchOutcome(value: string | null | undefined): value is PitchOutcome {
  return PITCH_OUTCOMES.some((p) => p.outcome === value);
}
