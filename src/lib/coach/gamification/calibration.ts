/**
 * Gamification Phase 6 — the calibration comparison (PURE). Given a set of {human blind score, model score} pairs
 * per dimension, report whether the model's score agrees with a human's — the honest check the leaderboard rests
 * on. No I/O; testable without a DB.
 *
 * The plan's threshold: a per-dimension mean absolute difference above ~1.5 (on the 0-10 scale) means that
 * dimension is NOT measuring what the rubric says — reported plainly, never averaged away. Only the LLM-JUDGED
 * dimensions are calibrated (the computed talk_ratio/question_rate are deterministic, not a matter of judgement).
 */

export const JUDGED_DIMENSIONS = ["opener", "objection", "tone", "close", "next_step"] as const;
export type JudgedDimension = (typeof JUDGED_DIMENSIONS)[number];

export const CALIBRATION_THRESHOLD = 1.5; // mean abs diff above this → the dimension is untrustworthy

export type DimScores = Partial<Record<JudgedDimension, number>>;
export interface CalibrationPair {
  sessionId: string;
  human: DimScores;
  model: DimScores;
}

export interface DimensionResult {
  dimension: JudgedDimension;
  n: number; // pairs where BOTH sides scored this dimension
  meanAbsDiff: number | null; // null when n === 0
  trustworthy: boolean | null; // null when n === 0; else meanAbsDiff <= threshold
}
export interface Disagreement {
  sessionId: string;
  dimension: JudgedDimension;
  human: number;
  model: number;
  diff: number;
}
export interface CalibrationReport {
  n: number; // number of sessions with at least one comparable dimension
  perDimension: DimensionResult[];
  worstDisagreements: Disagreement[]; // top 5 by absolute diff
  overallTrustworthy: boolean | null; // true only when every scored dimension is trustworthy; null if no data
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeCalibration(pairs: readonly CalibrationPair[]): CalibrationReport {
  const disagreements: Disagreement[] = [];
  const sessionsWithData = new Set<string>();

  const perDimension: DimensionResult[] = JUDGED_DIMENSIONS.map((dim) => {
    let sum = 0;
    let n = 0;
    for (const p of pairs) {
      const h = p.human[dim];
      const m = p.model[dim];
      if (typeof h === "number" && Number.isFinite(h) && typeof m === "number" && Number.isFinite(m)) {
        const diff = Math.abs(h - m);
        sum += diff;
        n += 1;
        sessionsWithData.add(p.sessionId);
        disagreements.push({ sessionId: p.sessionId, dimension: dim, human: h, model: m, diff });
      }
    }
    const meanAbsDiff = n > 0 ? round1(sum / n) : null;
    return { dimension: dim, n, meanAbsDiff, trustworthy: meanAbsDiff === null ? null : meanAbsDiff <= CALIBRATION_THRESHOLD };
  });

  disagreements.sort((a, b) => b.diff - a.diff);

  const scored = perDimension.filter((d) => d.trustworthy !== null);
  const overallTrustworthy = scored.length === 0 ? null : scored.every((d) => d.trustworthy === true);

  return {
    n: sessionsWithData.size,
    perDimension,
    worstDisagreements: disagreements.slice(0, 5),
    overallTrustworthy,
  };
}
