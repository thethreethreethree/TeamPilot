/**
 * ELOSALES Standard revision — /10 skill score → letter grade (A+/A/A-…).
 *
 * SPEC (PDF, Analytics §B): "the scores A+, A, A-, etc for Tone, Speed of Speech, talk/listen, questions,
 * closing, objections." The six dimensions already exist as /10 scores in skillAnalytics.ts; this is the
 * re-scaling the spec asks for, and NOTHING else — the underlying number and how it's computed are unchanged.
 *
 * FRAMEWORK (governs the shape of this, per the founder's "spec as written, GOVERNED by the framework"):
 *  - A11 (mirror, don't judge): a bare letter is a verdict. So `gradeSkill` returns the letter TOGETHER WITH the
 *    countable basis (`fromScore` = the /10 it summarizes) — the surface shows "A- · talk/listen 7.8/10".
 *
 *    ⚠️ CORRECTED 2026-07-17 — this comment used to end "…a summary of a count, not a standalone judgment
 *    [decision ①(b), the founder's announced default]". BOTH halves were wrong.
 *      (a) **The A11 defence does not survive A11's actual text.** Read at source: "the first is a verdict that
 *          can be wrong; the second is a count that cannot." The `/10` is itself a DERIVED SCORE, not countable
 *          behaviour — so pairing the letter with it does not convert a verdict into a count; it is two verdicts
 *          on one line. What actually satisfies A11 is the `breakdown` ("asked for the close in 2 of 9 calls"),
 *          which the manager view now renders under every grade. This function's output is A11-*compatible*
 *          only because that count travels beside it — not because `fromScore` is a count.
 *      (b) **"The founder's announced default" was a false attribution.** ①(b) was MY recommendation. The
 *          founder had announced nothing. Claiming their sanction for my own design choice is worse than
 *          offloading the choice to them (A20's inverse), and it is the kind of claim a reader cannot check.
 *    ⑤ remains OPEN and is now sharper than ①(b) ever was: per A1 the letter reinforces no clause of the
 *    constitution, and the C.A.R.E asset audit (2026-06-16 — agent-written, not the founder's) proposed labels "descriptive of the reply
 *    shape, not of agent worth". The live recommendation is to let the COUNT be the label. See the queue.
 *  - A18 (label is the defense against a leader misusing the data): the band labels invite COACHING, not
 *    penalty. There is deliberately NO "F". The lowest band is a "growth area" — a coaching target, never a
 *    stack-rank verdict. A manager reading "growth area" is invited to teach; a manager reading "F" is invited
 *    to penalize (A18's exact failure mode).
 *  - §3.5 / §3.6 honesty: a null score (not enough data — e.g. speed with no transcript timing, §3.4) grades to
 *    null, NOT to a low letter. An unmeasured skill is "still accumulating", never a bad grade.
 *
 * THE BANDS ARE §4 INSTRUMENTATION — NOT A FOUNDER PREFERENCE (corrected 2026-07-17, per A4).
 *
 * This comment used to read "a FOUNDER-TUNABLE constant… FLAGGED for founder review: the cutoffs are a
 * recommendation, not a mandate", and I told the founder in writing that they should set these against real rep
 * data. **That was wrong, and A4 says why:** "the constitutionally honest move is to surface uncertainties AS
 * uncertainties and let the §4 readout produce the answer. Pre-resolving them looks like decisiveness but
 * CONTAMINATES the experiment — you have encoded an assumption that should have been measured." The cutoffs are
 * neither mine to pick nor the founder's: they are a question for the DATA. Handing them to the founder as a
 * preference is the same error as picking them myself, wearing better manners.
 *
 * So they ship as A4 prescribes — a defensible starting point chosen to READ OUT CLEARLY, not because it is
 * provably right (A4's own example: "Coach v1 ships with 3 heuristics… whether 3 is enough is itself part of the
 * §4 readout, not a pre-decision"). They are aligned to the existing /10 UI semantics (<5 weak / 5–8 developing /
 * 8+ strong), NOT academic percentages — in this product 5/10 is "developing", not "50% = F".
 *
 * The §4 question these are instrumentation FOR: do reps whose growth-area skills are graded `D` improve faster
 * than those graded `C-` for the same underlying score? A band that changes behaviour is right; a band that only
 * changes the letter is cosmetic. Retune GRADE_BANDS when the data answers, not before — and note the readout is
 * currently impossible (A2: this revision emits no chain events, so nothing about it can be measured yet).
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
