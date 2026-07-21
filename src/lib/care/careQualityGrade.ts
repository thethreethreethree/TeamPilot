/**
 * C.A.R.E agent reply-quality → letter grade (Standard mode).
 *
 * FOUNDER REQUEST (2026-07-22): a Coach Assessment for C.A.R.E like the Sales Coach one — a letter grade
 * (Standard) backed by the communication books. Option A (founder-chosen): derive the grade from the
 * count aggregate we ALREADY compute (coachAggregate), no new instrumentation.
 *
 * GOVERNED by the same clauses as its siblings salesEloGrade.ts (ELO→letter) and skillGrade.ts
 * (/10→letter) — read those headers for the full reasoning. The same guarantees bind here:
 *
 *  - §A18 (label is the defense): NO "F". Floor is "D" / growth-area — a coaching target, never a penalty
 *    verdict. (Separately: WHETHER a manager may see a per-agent grade at all is a §A18 STRUCTURAL
 *    question — fetchTeamGrowth deliberately refuses per-agent rows for the leader. This helper only maps
 *    a score→letter; where that letter is shown, and to whom, is decided by the caller and was escalated
 *    to the founder. This function is safe for the §A10 self-view regardless.)
 *
 *  - §A11 (mirror, not verdict): the letter must travel with its COUNT basis (repliesGraded + the raw
 *    positive/risk counts). This function returns only the letter+score; the surface supplies the counts.
 *
 *  - §A4 (don't pre-resolve what data should answer): the score FORMULA and the band cutoffs are §4
 *    instrumentation, a defensible starting point — NOT a founder preference to hand-set. They read out
 *    clearly against the existing coachAggregate semantics; retune when real data answers, not before.
 *
 *  - §3.5 (honest empty): zero graded replies → null (an honest "not yet"), never a low letter.
 */

import type { LetterGrade } from "@/lib/coach/v5/skillGrade";

/** The count aggregate this grades — the shape of coachAggregate on AgentGrowthSnapshot / TeamGrowthSnapshot. */
export type CareCoachAggregate = {
  repliesGraded: number;
  acknowledgedCount: number;
  answeredCount: number;
  nextStepCount: number;
  risks: {
    unsupportedAbsolutes: number;
    fabricatedSpecifics: number;
    emptyFiller: number;
  };
};

export type CareGrade = {
  /** The letter, or null when there are no graded replies yet (§3.5 — never a low letter for no data). */
  letter: LetterGrade | null;
  /** The 0..1 Care Quality score the letter summarizes (travels with the letter; §A11 basis is the raw counts). */
  score: number | null;
  tier: "strong" | "solid" | "developing" | "growth-area" | "not-yet";
};

/**
 * Care Quality score (0..1) from the count aggregate. §A4 instrumentation — a starting formula:
 *   positiveRate = share of the three positive signals present across replies
 *                = (acknowledged + answered + next_step) / (3 · repliesGraded)
 *   riskRate     = average risk flags per reply = (all three risk counts) / repliesGraded
 *   score        = clamp01(positiveRate − min(riskRate, 0.5))   // risks subtract, capped so one bad
 *                                                                // stretch can't zero out a real record
 * Returns null when nothing has been graded (§3.5).
 */
export function careQualityScore(agg: CareCoachAggregate): number | null {
  if (!agg || agg.repliesGraded <= 0) return null;
  const n = agg.repliesGraded;
  const positiveRate =
    (agg.acknowledgedCount + agg.answeredCount + agg.nextStepCount) / (3 * n);
  const riskRate =
    (agg.risks.unsupportedAbsolutes +
      agg.risks.fabricatedSpecifics +
      agg.risks.emptyFiller) /
    n;
  const score = positiveRate - Math.min(riskRate, 0.5);
  return Math.max(0, Math.min(1, score));
}

/** Cutoffs are INCLUSIVE lower bounds on the 0..1 score. Highest match wins. No "F" (§A18). */
type Band = { min: number; letter: LetterGrade; tier: Exclude<CareGrade["tier"], "not-yet"> };

const FLOOR_BAND: Band = { min: 0, letter: "D", tier: "growth-area" };

const GRADE_BANDS: ReadonlyArray<Band> = [
  { min: 0.9, letter: "A+", tier: "strong" },
  { min: 0.82, letter: "A", tier: "strong" },
  { min: 0.75, letter: "A-", tier: "strong" },
  { min: 0.68, letter: "B+", tier: "solid" },
  { min: 0.6, letter: "B", tier: "solid" }, // "meets the standard" — a competent-reply profile
  { min: 0.52, letter: "B-", tier: "solid" },
  { min: 0.44, letter: "C+", tier: "developing" },
  { min: 0.36, letter: "C", tier: "developing" },
  { min: 0.28, letter: "C-", tier: "developing" },
  FLOOR_BAND,
];

/**
 * Map a Care Quality score (0..1, or null) to a coaching-framed letter grade. null (no graded replies)
 * → an honest not-yet grade, NOT a low letter (§3.5). Out-of-range inputs are clamped to [0,1].
 */
export function careQualityToGrade(score: number | null | undefined): CareGrade {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return { letter: null, score: null, tier: "not-yet" };
  }
  const clamped = Math.max(0, Math.min(1, score));
  const band: Band = GRADE_BANDS.find((b) => clamped >= b.min) ?? FLOOR_BAND;
  return { letter: band.letter, score: clamped, tier: band.tier };
}

/** Convenience: aggregate → grade in one step. */
export function gradeCareAggregate(agg: CareCoachAggregate): CareGrade {
  return careQualityToGrade(careQualityScore(agg));
}
