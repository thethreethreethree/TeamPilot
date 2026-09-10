/**
 * Whether a closed decision actually held.
 *
 * `chat_topics.close_durability` is `held | reopened | partial | unknown`, or
 * null when nobody has reviewed the outcome yet. It is the FOLLOW-THROUGH on a
 * conversation, and it changes what a closed topic means to whoever reads it
 * next: acting on a conclusion that was quietly reopened is worse than not
 * finding the conclusion at all.
 *
 * NULL AND 'unknown' ARE THE SAME THING TO A REP and are deliberately shown as
 * nothing. Neither means the decision failed — they mean nobody has judged it.
 * Rendering "unknown" as an outcome would put a word on the screen that a rep
 * reads as a verdict; saying nothing is the honest state, and the topic already
 * says it is closed.
 *
 * REVIEWING an outcome is an admin action on the website and is NOT built here.
 * The phone reads the judgement; it does not make it.
 */

export type Durability = 'held' | 'reopened' | 'partial';

/** The rep's words for each, or null when there is nothing honest to say. */
export function durabilityLine(value: string | null | undefined): string | null {
  switch (value) {
    case 'held':
      return 'What was decided held.';
    case 'reopened':
      return 'This was reopened afterwards — the decision did not hold.';
    case 'partial':
      return 'Partly held. Some of what was decided did not stick.';
    default:
      // null, 'unknown', or a value this app has never heard of. Silence beats
      // a word a rep would read as a verdict.
      return null;
  }
}

/** True when the outcome is one a rep should notice rather than skim past. */
export function durabilityIsWarning(value: string | null | undefined): boolean {
  return value === 'reopened' || value === 'partial';
}
