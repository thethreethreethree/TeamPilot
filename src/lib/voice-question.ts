/**
 * voice-question — telling a rep, in the list, which calls are waiting on one tap.
 *
 * WHY THIS IS NOT OPTIONAL. Recovery saves a dropped call's words as `unknown` when it
 * cannot work out which voice is the rep, and every coaching engine filters on
 * `speaker === "agent"` — so an unanswered call is stored, readable, and scores nothing.
 * The session screen now asks the question. But nobody opens a call that showed them
 * nothing the first time, and the recovered ones are weeks old. **A question nobody sees
 * has not been asked**, and the transcript stays unusable, which is precisely the half of
 * the founder's instruction that "save the words" does not satisfy.
 *
 * So it is surfaced where a rep already looks: the list, on the row.
 */

/**
 * What is known about a row's attribution.
 *
 * Both counts are nullable and the nulls mean genuinely different things from zero.
 * `segments` is null when the embedded count could not be read; `unattributed` is null
 * when the side query did not run or failed. Either one unknown means the answer to
 * "does this need a tap?" is unknown, and an unknown must not render as a chip.
 */
export type VoiceQuestionCounts = {
  /** Total transcript segments, or null when it could not be read. */
  segments: number | null;
  /** Segments whose speaker is `unknown`, or null when it could not be read. */
  unattributed: number | null;
};

/**
 * Does this call need the rep to say whose voice it is?
 *
 * True only when BOTH counts are known, there are words, and every one of them is
 * unattributed. Requiring ALL of them — rather than any — is what keeps this honest: a
 * transcript with even one real `agent` turn already has an answer, `/label-transcript`
 * would 409 a second one, and a chip inviting a tap that the server refuses would be a
 * promise the app cannot keep.
 *
 * An unknown is never a zero, and here it is never a chip either: if either count is
 * null the row says nothing rather than guessing. A chip that appears because a side
 * query failed is worse than no chip.
 */
export function needsVoiceAnswer(counts: VoiceQuestionCounts): boolean {
  const { segments, unattributed } = counts;
  /*
    THIS LINE IS DOCUMENTATION, NOT A GATE, and saying so is the point.

    Mutating it to `&&` was tried and NO test failed. The reason is JavaScript: `null <= 0`
    is `true`, so a null `segments` already falls out at the next guard, and `null >= 5` is
    `false`, so a null `unattributed` already fails the comparison. There is no input for
    which removing this line changes the answer, and therefore no test that can prove it.

    It stays because a reader should not have to know that `null <= 0` is true to see that
    a missing count cannot become a chip. But nobody should believe a test is holding it:
    if the guards below are ever reordered, this line becomes load-bearing with no coverage
    behind it, and that is the moment to write the test that could not exist today.
  */
  if (segments === null || unattributed === null) return false;
  if (segments <= 0) return false;
  return unattributed >= segments;
}

/** The row chip. Short, because it sits beside the other chips on a narrow phone row. */
export const VOICE_QUESTION_CHIP = 'Needs your voice';

/**
 * What a screen reader says, which is not what the chip says.
 *
 * The chip is three words because the row is narrow. Read aloud, three words out of
 * context state a problem without saying what to do about it, so the spoken form carries
 * the action and the reason.
 */
export const VOICE_QUESTION_SPOKEN =
  'Waiting on you: say which voice is yours and this call can be coached.';
