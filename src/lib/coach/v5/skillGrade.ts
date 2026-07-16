/**
 * ELOSALES Standard revision — /10 skill score → letter grade (A+/A/A-…).
 *
 * SPEC (PDF, Analytics §B): "the scores A+, A, A-, etc for Tone, Speed of Speech, talk/listen, questions,
 * closing, objections." The six dimensions already exist as /10 scores in skillAnalytics.ts; this is the
 * re-scaling the spec asks for, and NOTHING else — the underlying number and how it's computed are unchanged.
 *
 * FRAMEWORK (governs the shape of this, per the founder's "spec as written, GOVERNED by the framework"):
 *  - A11 (mirror, don't judge): a bare letter is a verdict. So `gradeSkill` returns the letter TOGETHER WITH the
 *    countable basis (`fromScore` = the /10 it summarizes) — the surface shows "A- · talk/listen 7.8/10", a
 *    summary of a count, not a standalone judgment. [This is decision ①(b), the founder's announced default.]
 *  - A18 (label is the defense against a leader misusing the data): the band labels invite COACHING, not
 *    penalty. There is deliberately NO "F". The lowest band is a "growth area" — a coaching target, never a
 *    stack-rank verdict. A manager reading "growth area" is invited to teach; a manager reading "F" is invited
 *    to penalize (A18's exact failure mode).
 *  - §3.5 / §3.6 honesty: a null score (not enough data — e.g. speed with no transcript timing, §3.4) grades to
 *    null, NOT to a low letter. An unmeasured skill is "still accumulating", never a bad grade.
 *
 * THE BANDS ARE A FOUNDER-TUNABLE CONSTANT (like skillAnalytics' band constants). They are aligned to the
 * existing /10 UI semantics (<5 weak / 5–8 developing / 8+ strong), NOT academic percentages (5/10 is not "50% =
 * F" — in the current product 5/10 is "developing"). Adjust GRADE_BANDS to retune; the tier/coaching label moves
 * with it. FLAGGED for founder review: the exact cutoffs below are a recommendation, not a mandate.
 */

export type LetterGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D";

export type SkillGrade = {
  /** The letter, or null when the skill has no score yet (§3.5 honest-empty — never a low grade for no data). */
  letter: LetterGrade | null;
  /** The /10 this letter summarizes (A11 — the countable basis travels with the verdict). null when unscored. */
  fromScore: number | null;
  /** Coaching-framed tier for color/label (A18 — invites teaching, never ranking). */
  tier: "strong" | "solid" | "developing" | "growth-area" | "not-yet";
};

/**
 * Cutoffs are INCLUSIVE lower bounds on the /10 score. Highest matching band wins.
 * Tiers map to the existing SkillScores color semantics: strong≈emerald(≥8), solid/developing≈brand(≥5),
 * growth-area≈amber(<5). Tunable — FLAGGED for founder review.
 */
type Band = { min: number; letter: LetterGrade; tier: SkillGrade["tier"] };

/** The floor band (min 0) always matches any clamped [0,10] score — kept as a non-optional const so the
 *  resolver below is provably total (no undefined). A18: the floor is "D"/growth-area, never an "F". */
const FLOOR_BAND: Band = { min: 0.0, letter: "D", tier: "growth-area" };

const GRADE_BANDS: ReadonlyArray<Band> = [
  { min: 9.5, letter: "A+", tier: "strong" },
  { min: 9.0, letter: "A", tier: "strong" },
  { min: 8.5, letter: "A-", tier: "strong" },
  { min: 8.0, letter: "B+", tier: "solid" },
  { min: 7.0, letter: "B", tier: "solid" },
  { min: 6.5, letter: "B-", tier: "solid" },
  { min: 6.0, letter: "C+", tier: "developing" },
  { min: 5.5, letter: "C", tier: "developing" },
  { min: 5.0, letter: "C-", tier: "developing" },
  FLOOR_BAND,
];

/**
 * Map a /10 skill score to a coaching-framed letter grade. `score === null` (unmeasured / not enough data)
 * returns an honest not-yet grade — NOT a low letter (§3.5/§3.6). Out-of-range inputs are clamped to [0,10].
 */
export function gradeSkill(score: number | null | undefined): SkillGrade {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return { letter: null, fromScore: null, tier: "not-yet" };
  }
  const clamped = Math.max(0, Math.min(10, score));
  const band: Band = GRADE_BANDS.find((b) => clamped >= b.min) ?? FLOOR_BAND;
  return { letter: band.letter, fromScore: clamped, tier: band.tier };
}
