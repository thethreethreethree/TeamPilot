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

/** The row chip, for the rep whose call it is. Short — the row is narrow. */
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

/**
 * The same fact, shown to a MANAGER looking at somebody else's call.
 *
 * TWO REASONS IT CANNOT BE THE SAME WORDS, and the second is the important one.
 *
 * The small reason: a manager cannot answer. The route is owner-only, so "Needs your
 * voice" on their screen invites a tap that returns 403 — an affordance that lies, and a
 * rep-facing instruction pointed at the wrong person.
 *
 * The real reason is A18: when a system surfaces human-behaviour data to somebody with
 * authority over its subject, the LABEL decides what that authority is invited to do.
 * A manager scrolling a rep's calls sees this one carrying no coaching scores at all. With
 * no label the absence reads as the rep having done badly — a data gap presented as a
 * measurement, and then acted on. With "Needs your voice" it reads as the rep having
 * ignored something they were asked to do. Neither is true: the system could not tell which
 * voice was theirs, and has not been told yet.
 *
 * So the manager's label names the SYSTEM's state, not the rep's, and points at the one
 * thing that resolves it. It invites a reminder, never a mark against them.
 */
export const VOICE_QUESTION_CHIP_OTHER = 'Not scored yet';

export const VOICE_QUESTION_SPOKEN_OTHER =
  'Not scored yet: we could not tell which voice was the rep, so this call is waiting on a voice check from them.';

/**
 * Which wording this row gets, or null when it gets none.
 *
 * `isOwnCall` decides, not a role check — a manager scrolling their OWN calls is a rep
 * looking at their own work and should get the actionable words.
 */
export function voiceQuestionWording(
  counts: VoiceQuestionCounts,
  isOwnCall: boolean,
): { chip: string; spoken: string } | null {
  if (!needsVoiceAnswer(counts)) return null;
  return isOwnCall
    ? { chip: VOICE_QUESTION_CHIP, spoken: VOICE_QUESTION_SPOKEN }
    : { chip: VOICE_QUESTION_CHIP_OTHER, spoken: VOICE_QUESTION_SPOKEN_OTHER };
}
