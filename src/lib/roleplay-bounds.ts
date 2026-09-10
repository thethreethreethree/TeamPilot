/**
 * The roleplay's limits and personas — the parts with no network in them.
 *
 * SEPARATE BECAUSE THE RULES ARE THE PART WORTH TESTING, and the sender they sit
 * beside cannot load under the test runner: it reaches `expo/fetch`, a native
 * module. This is the fourth module in this project to be split for that reason,
 * and the pattern is now deliberate rather than incidental — pure rules go in
 * their own file, the network stays next door.
 *
 * WHAT MAKES THESE RULES SHARP. The roleplay route is stateless by design; its
 * own comment says a run "must NOT pollute the rep's session history or
 * metrics". Nothing is persisted anywhere, so the phone is the only place a
 * practice run exists while it is happening — and the route REFUSES an over-long
 * conversation with a 400 rather than trimming it. A rep who hits that limit
 * mid-flow loses the run. Getting the count right is the difference.
 */

/** The web's own four, verbatim — same words, so a persona means the same thing
 *  in both products. */
export const PERSONAS: { label: string; hint: string }[] = [
  { label: 'Skeptical & guarded', hint: 'Slow to trust, needs convincing' },
  { label: 'Busy & rushed', hint: 'Little time, wants it fast' },
  { label: 'Price-focused', hint: 'Objects on cost and value' },
  { label: 'Friendly but non-committal', hint: "Pleasant, won't commit" },
];

/** The route's own bounds, named so the screen can stop BEFORE a 400. */
export const MAX_MESSAGES = 80;
export const MAX_MESSAGE_CHARS = 4000;

/**
 * Enough of a pitch to be worth reviewing.
 *
 * The route will happily review two lines and produce something shaped like
 * coaching. A rep who gets a "review" of one exchange learns the review is
 * cheap and stops reading them.
 */
export const MIN_REP_TURNS_FOR_REVIEW = 3;

export type RoleplayRole = 'rep' | 'prospect';
export type RoleplayMessage = { role: RoleplayRole; text: string };

/**
 * How many exchanges are left before the route refuses the next one.
 *
 * Divided by two because a turn is TWO messages — the rep's line and the
 * prospect's reply. Counting only the rep's would let the screen promise a turn
 * the route then rejects, which is exactly the loss this exists to prevent.
 */
export function turnsRemaining(messages: RoleplayMessage[]): number {
  return Math.max(0, Math.floor((MAX_MESSAGES - messages.length) / 2));
}

/** Only the REP's turns count — the thing being reviewed is what they said. */
export function canReview(messages: RoleplayMessage[]): boolean {
  return messages.filter((m) => m.role === 'rep').length >= MIN_REP_TURNS_FOR_REVIEW;
}

/**
 * Where the conversation is happening.
 *
 * NOT COSMETIC. The roleplay route feeds this straight into the prompt for both
 * the prospect and the reviewer: `in_person` is described as "an in-person,
 * at-the-door / field conversation (body language, doorstep timing matter)" and
 * `video` as "a remote video call (framing, pacing, screen presence matter)".
 *
 * The app hard-coded `in_person`, which is right for a door rep and wrong for
 * everyone else — a rep practising a video call was being coached on doorstep
 * timing. The website has offered this choice all along; the phone did not.
 *
 * `in_person` is FIRST and is the default, exactly as the website has it, so a
 * door rep never has to touch this.
 */
export const CONTEXTS: { value: 'in_person' | 'video'; label: string; hint: string }[] = [
  { value: 'in_person', label: 'At the door', hint: 'Body language and timing matter' },
  { value: 'video', label: 'Video call', hint: 'Framing, pacing and screen presence' },
];
