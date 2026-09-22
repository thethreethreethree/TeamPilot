/**
 * The rubric, fetched — and the one rule this app is permitted to re-derive.
 *
 * WHY THE RUBRIC IS FETCHED AND NOT TYPED IN. It is a versioned document: `pitches.rubric_version`
 * pins the config a score was computed under, and the server's copy may not be edited in place once
 * scores reference it. A transcription on the phone would explain September's pitches with
 * December's numbers, and every value would still look plausible. The endpoint exists for exactly
 * this reason — added 2026-09-22, because the rubric had three consumers that could `import` it and
 * a fourth that could not.
 *
 * THE FETCH IS NOT IN THIS FILE, AND THAT IS THE POINT. `coach-api` imports `expo/fetch`, a native
 * module the test runner cannot load, so anything sharing a module with it is untestable — the whole
 * file fails to import, not just the network call. This codebase already paid for that: the docblock
 * in `after-pitch-empty.ts` says its rules moved out because "THIS file imports the network client
 * (coach-api → expo/fetch, a native module), so a rule living here cannot be exercised by a test at
 * all". `lowestSection` below is the rule this build most needs a test on, so it lives with the types
 * and `fetchRubric` lives in `api.ts` beside every other request.
 */
import type { SectionId } from '@/lib/pitch-score/types';

export type RubricSection = { id: SectionId; label: string; maxPoints: number };

export type RubricElement = {
  id: string;
  section: SectionId;
  label: string;
  points: number;
  /** The rubric's "point that needs to land". Shown as the element's own explanation. */
  whatCounts: string;
};

export type RubricBonus = {
  id: string;
  label: string;
  points: number;
  /** Awarded more than once per pitch, up to `maxTotal`. Only buying questions behave this way. */
  repeatable?: boolean;
  maxTotal?: number;
  /** Inferred from ambient audio rather than words, so it carries a confidence threshold. */
  audioInferred?: boolean;
  detectionNotes: string;
};

export type RubricViolation = {
  id: string;
  label: string;
  /** A POSITIVE magnitude. The minus sign belongs to the display, as it does on every other stat. */
  deduction: number;
  repeatable?: boolean;
  maxTotal?: number;
  /** The rubric escalates a rude flag to a human: "flagged for manager review". */
  flagsForReview?: boolean;
  trigger: string;
};

export type RubricResponse = {
  version: string;
  /** The three numbers the sheet prints as "100 + 30 − Viol. = 130 Max score". */
  baseMax: number;
  bonusCap: number;
  maxScore: number;
  gradeCredit: Record<'hit' | 'partial' | 'missed', number>;
  sections: RubricSection[];
  elements: RubricElement[];
  bonuses: RubricBonus[];
  violations: RubricViolation[];
};

/**
 * Which section carries the LOWEST badge.
 *
 * ── A DELIBERATE RE-DERIVATION, UNDER §2.2's CONDITIONS ─────────────────────────────────────────
 *
 * The authority is `lowestSection` in the web repository's `src/lib/coach/pitchScore/rubric.ts`
 * (read 2026-09-22, lines 227-242). This app cannot import it and the server does not return the
 * verdict, so the decision is re-derived here — which §2.2 permits only when it is unavoidable, and
 * only if the copy "mirrors the authority's condition term-for-term with a comment pointing at the
 * source, AND a drift-guard test exercises BOTH branches of every term".
 *
 * The four terms, each mirrored deliberately rather than incidentally:
 *
 *   1. **Ratio, not points.** `pts / maxPoints`. This is the whole rule and the naive build gets it
 *      wrong: on the team board Transitions **4.7** is the lowest absolute score, and **Close 8.6**
 *      carries the badge, because `8.6/15 = 57.3%` is below `4.7/8 = 58.8%`. Sections are not
 *      comparable on raw points — their maxima differ by a factor of four, 8 against 35.
 *   2. **Iterate the rubric's own section order**, so a tie resolves the same way in both copies.
 *   3. **Strict `<`.** Ties keep the EARLIER section. A `<=` here would silently disagree with the
 *      web the first time two sections tie, which is the drift §2.2 describes.
 *   4. **Skip an absent section** rather than treating it as zero. A section with no average is
 *      unknown, and unknown is not "worst" — scoring it zero would badge a section nobody measured.
 *
 * Sections come from the fetched rubric, never from a local constant, so the maxima cannot go stale
 * against the version that produced the scores being rendered.
 *
 * WHY NOT SUM `elementStats` INSTEAD OF FETCHING. Because `aggregatePitches` omits any element with
 * no graded pitches, so a section holding an element the rep never reached would report a smaller
 * max, a higher ratio, and could lose the badge. It is correct for a rep who reached everything,
 * which is what makes it dangerous.
 */
export function lowestSection(
  sectionAverages: Readonly<Partial<Record<SectionId, number>>>,
  sections: readonly RubricSection[],
): SectionId | null {
  let worst: SectionId | null = null;
  let worstRatio = Infinity;
  for (const s of sections) {
    const pts = sectionAverages[s.id];
    if (pts === undefined) continue;
    // Guard the authority does not need: its maxima are constants it owns. Here they arrive over
    // the wire, and a zero would make every ratio Infinity and badge the last section standing.
    if (!s.maxPoints) continue;
    const ratio = pts / s.maxPoints;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worst = s.id;
    }
  }
  return worst;
}
