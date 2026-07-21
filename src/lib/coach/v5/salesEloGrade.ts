/**
 * Sales ELO rating → letter grade (Standard mode only).
 *
 * FOUNDER REQUEST (2026-07-22): on the Coach Assessment page, Standard mode should show a LETTER
 * GRADE instead of the raw ELO number (Expert keeps the number + gauge). This is the ELO→letter
 * re-scaling — the underlying rating and how it's computed (salesElo.ts) are unchanged.
 *
 * GOVERNED by the same clauses that shaped skillGrade.ts (the /10→letter sibling) — read that file's
 * header for the full reasoning; the same three constraints bind here:
 *
 *  - §A18 (label is the defense against a leader misusing the data): the bands invite COACHING, not
 *    penalty. There is deliberately NO "F". The floor is "D" / growth-area — a coaching target, never a
 *    stack-rank verdict. This mirrors skillGrade.ts exactly (a manager reading "growth area" is invited
 *    to teach; one reading "F" is invited to punish — A18's exact failure mode).
 *
 *  - §A11 (mirror, not verdict): a bare letter is a verdict. `eloToGrade` returns the letter TOGETHER
 *    WITH `fromRating` (the ELO it summarizes), but — as skillGrade.ts corrected 2026-07-17 — a derived
 *    rating is NOT a countable basis, so pairing letter+rating is not itself A11-satisfying. What
 *    satisfies A11 is the COUNT that must travel beside the letter on the surface: "N scored calls" +
 *    the trend delta (both real counts). The badge that renders this MUST show that count. This function
 *    only maps the number; the A11 defense lives in the component.
 *
 *  - §A4 (don't pre-resolve what the data should answer): the cutoffs are §4 instrumentation, NOT a
 *    founder preference to hand-set. They ship as a defensible starting point aligned to the ELO's own
 *    semantics — 1500 is the "competent call" standard (salesElo.ts OPPONENT_RATING), so B = "meets the
 *    standard", above = beating it, below = growth. The practical band against a 1500 opponent is
 *    ~1000–1900 (salesElo.ts:31-33), which these cutoffs are spaced across. Retune when real rep data
 *    reads out, not before. (Per §A2 the readout does not exist yet — this emits no chain events.)
 *
 * Reuses the LetterGrade type + tier vocabulary from skillGrade.ts so the two surfaces read identically.
 */

import type { LetterGrade } from "./skillGrade";

export type EloGrade = {
  /** The letter. Callers handle the no-games / provisional states BEFORE calling this. */
  letter: LetterGrade;
  /** The ELO this letter summarizes (travels with the letter; see §A11 note above). */
  fromRating: number;
  /** Coaching-framed tier for color/label (A18 — invites teaching, never ranking). Same vocabulary
   *  as skillGrade.ts (minus "not-yet", which the badge represents as its own empty state). */
  tier: "strong" | "solid" | "developing" | "growth-area";
};

/**
 * Cutoffs are INCLUSIVE lower bounds on the ELO rating. Highest matching band wins. Anchored so B = 1500
 * (the competent-call standard). No "F" — the floor is "D"/growth-area (§A18). See header re: §A4.
 */
type Band = { min: number; letter: LetterGrade; tier: EloGrade["tier"] };

/** The floor band always matches (min -Infinity) so the resolver is provably total. §A18: floor is "D". */
const FLOOR_BAND: Band = { min: Number.NEGATIVE_INFINITY, letter: "D", tier: "growth-area" };

const ELO_GRADE_BANDS: ReadonlyArray<Band> = [
  { min: 1800, letter: "A+", tier: "strong" },
  { min: 1720, letter: "A", tier: "strong" },
  { min: 1650, letter: "A-", tier: "strong" },
  { min: 1580, letter: "B+", tier: "solid" },
  { min: 1500, letter: "B", tier: "solid" }, // meets the competent-call standard (1500)
  { min: 1440, letter: "B-", tier: "solid" },
  { min: 1370, letter: "C+", tier: "developing" },
  { min: 1300, letter: "C", tier: "developing" },
  { min: 1230, letter: "C-", tier: "developing" },
  FLOOR_BAND,
];

/**
 * Map a Sales ELO rating to a coaching-framed letter grade. The caller is responsible for the
 * "no scored calls yet" empty state (§3.5 honest-empty — an unrated rep is "not yet", never a low
 * letter); this function assumes a real rating from a played game.
 */
export function eloToGrade(rating: number): EloGrade {
  const band: Band = ELO_GRADE_BANDS.find((b) => rating >= b.min) ?? FLOOR_BAND;
  return { letter: band.letter, fromRating: Math.round(rating), tier: band.tier };
}
