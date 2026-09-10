import type { AfterPitch } from '@/lib/after-pitch';

/**
 * WHY there is nothing to show in a debrief — because the two reasons need opposite
 * sentences, and the app gave the same one to both.
 *
 * THE WRONG SENTENCE THIS REMOVES. An empty debrief always said: *"There was not enough of
 * a conversation here for the coach to say anything useful. That is a fact about the call,
 * not about you."* Kind, and for most of these calls false.
 *
 * Measured on production 10 September 2026: of the 168 sessions the coaching engines can
 * read, 56 ran and produced nothing — and they are systematically the LONGER calls, median
 * 683 words against 362 for the ones that succeeded. So the app was telling a rep that their
 * 683-word conversation was not enough of a conversation. It is the same failure this app
 * spends real effort avoiding everywhere else — an absence explained with a confident wrong
 * reason — except this one lands on the rep, about their own work.
 *
 * SCORES ARE THE DISCRIMINATOR, and the website already uses exactly this test, so the two
 * products agree about what happened. A score means the call WAS substantial enough to
 * measure. A blank write-up on a scored call is the write-up failing, not the call being
 * thin.
 *
 * IT LIVES IN ITS OWN FILE for the reason this codebase already records: `after-pitch.ts`
 * imports the network client, which reaches `expo/fetch` — a native module that cannot load
 * under plain Node — so a rule left in there cannot be tested at all. The `AfterPitch` import
 * here is TYPE-ONLY and erased at runtime, so nothing native comes with it.
 */

export type EmptyReadReason =
  /** Nothing has been written for this call yet — offer to write it. */
  | 'none'
  /** Scored, so there was plenty to say, and the write-up came back empty. Rebuilding works. */
  | 'engine-blank'
  /** No scores either. Genuinely little to go on — the only case the original sentence fits. */
  | 'thin';

/**
 * Is there anything in this debrief worth drawing?
 *
 * THE ONE COPY. It lived in `after-pitch.ts`, which imports the network client and so cannot
 * be loaded in a test at all. Moving it here rather than copying it was deliberate: this
 * project has already paid for a duplicated rule — a band threshold kept in two places told
 * one rep they were "Elite" on one screen and "Strong" on another, because only one copy
 * rounded. Two copies of a rule always pass their own tests; the only symptom is that the
 * files disagree. `after-pitch.ts` re-exports this, so every existing caller is unchanged.
 */
export function hasContent(summary: AfterPitch | null): boolean {
  if (!summary) return false;
  if (summary.hasSignal === false && summary.narrative?.hasSignal === false) return false;
  return (
    (summary.narrative?.strengths?.length ?? 0) > 0 ||
    (summary.narrative?.growthAreas?.length ?? 0) > 0 ||
    Boolean(summary.focus)
  );
}

/** Null when there IS something to show, so a caller can use it as the condition itself. */
export function emptyReadReason(summary: AfterPitch | null): EmptyReadReason | null {
  if (!summary) return 'none';
  if (hasContent(summary)) return null;
  return (summary.scores?.length ?? 0) > 0 ? 'engine-blank' : 'thin';
}
