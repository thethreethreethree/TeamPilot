/**
 * The six Pitch Score milestones — their names, their criteria, and nothing else.
 *
 * NO DATE IS DERIVED HERE, and that is not a style choice. Every one of these is a FIRST or an
 * Nth — the first counted pitch, the hundredth, the first pitch over 100 — and the phone never
 * holds a rep's whole history. A rep with four hundred pitches would have this file confidently
 * name the wrong day as their first, and a wrong date is worse than no date because it looks
 * exactly like a right one. The server reads oldest-first for the same reason and sends the dates.
 *
 * THE TITLES AND CAPTIONS ARE MIRRORED, term for term, from the web's
 * `src/lib/coach/pitchScore/milestones.ts` (`PITCH_MILESTONE_TITLES` and
 * `PITCH_MILESTONE_CAPTIONS`, read 2026-09-22). They are strings rather than logic, but they are
 * still one decision in two places, so the source is named and the drift test below exercises
 * every key rather than sampling.
 *
 * TWO OF THE CAPTIONS ARE THE REASON THAT MATTERS. The web's docblock records them:
 *
 *   - **Clean sweep is "every phase fully hit", not "no violations"** — the obvious reading of the
 *     name, and wrong.
 *   - **Full bundle names three products** (DTV + Wireless + ADT), not "several bonuses".
 *
 * A phone that captioned these from the badge names would print two plausible sentences that
 * describe pitches the badge does not fire on. `tripleDigits` and `inTheDoor` carry no caption on
 * the sheet and ARE inferred — the web says so, and so does this file, so the next reader can tell
 * which definitions came from the founder's sheet and which from a reasonable guess.
 *
 * NOT THE ARENA'S BADGES. The phone ships a second milestone strip derived from the points ledger,
 * and under the founder's R-D ruling both now sit one swipe apart in the same segmented control.
 * `spark` there is the first scored SESSION — including sessions Pitch Score refuses to count —
 * and its `century` counts sessions where this one counts qualifying pitches. The two diverge
 * permanently for any rep who records a pitch that does not qualify. The Arena's labels were
 * changed to say "session" in the same commit as this file, mirroring the web's 2026-09-21
 * relabelling, so no rep is shown two badges called "First pitch" that mean different things and
 * were earned on different days.
 */
import { milestoneStatus, type MilestoneStatus } from '@/lib/gamification/milestone-dates';
import { MILESTONE_KEYS, type MilestoneDates, type MilestoneKey } from '@/lib/pitch-score/types';

/** The sheet's badge names. Mirrored from `PITCH_MILESTONE_TITLES`. */
export const PITCH_MILESTONE_TITLES: Record<MilestoneKey, string> = {
  firstPitch: 'First pitch',
  tripleDigits: 'Triple digits',
  inTheDoor: 'In the door',
  fullBundle: 'Full bundle',
  cleanSweep: 'Clean sweep',
  century: 'Century',
};

/**
 * What each one takes, in the rep's words. Mirrored from `PITCH_MILESTONE_CAPTIONS`.
 *
 * Four are the founder's sheet verbatim. `tripleDigits` and `inTheDoor` are the web's inferences —
 * 100+ on a scale that reaches 130, and the rubric's own `bonus.inside` — and are marked as such
 * where they are defined on the server rather than re-inferred here.
 */
export const PITCH_MILESTONE_CAPTIONS: Record<MilestoneKey, string> = {
  firstPitch: 'Your first counted pitch',
  tripleDigits: 'A single pitch over 100',
  inTheDoor: 'Inside the house or backyard',
  fullBundle: 'DTV + Wireless + ADT in one pitch',
  cleanSweep: 'Every phase fully hit',
  century: '100 scored pitches',
};

export type PitchMilestoneRow = {
  key: MilestoneKey;
  title: string;
  /** The criteria. §5.1 element 10: the mockup shows it only where the badge is UNEARNED. */
  caption: string;
  status: MilestoneStatus;
};

/**
 * The strip, in the sheet's order, every badge present whether earned or not.
 *
 * AN UNEARNED BADGE IS LISTED WITH ITS CONDITION. One whose condition is hidden is a locked box:
 * it tells a rep that something exists and nothing about how to get it. The Arena settled this the
 * same way and this strip does not re-decide it.
 *
 * THREE STATES, NOT TWO, and the third is the one that matters. `milestoneStatus` is shared with
 * the Arena rather than copied: `null` is "the server looked and it has not happened", an absent
 * key is "the server did not say". Rendering the second as the first tells a rep who has recorded
 * a hundred pitches that they have recorded none.
 */
export function pitchMilestoneRows(
  dates: MilestoneDates | null | undefined,
): PitchMilestoneRow[] {
  return MILESTONE_KEYS.map((key) => ({
    key,
    title: PITCH_MILESTONE_TITLES[key],
    caption: PITCH_MILESTONE_CAPTIONS[key],
    status: milestoneStatus(dates, key),
  }));
}
