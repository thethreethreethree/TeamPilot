/**
 * Score Calibration (spec 5.4) — the honesty gate.
 *
 * WHAT IT IS FOR. A manager hand-scores an anonymised transcript BLIND, then
 * sees their scores against the model's. It measures whether the AI scorer can
 * be trusted before that scorer is allowed to drive anybody's rank. The spec is
 * explicit that it "measures trust, it does not (yet) act on it" — so nothing
 * here feeds back into points.
 *
 * BLIND MEANS BLIND. The model's scores are withheld until the manager has
 * submitted their own. Showing them first would anchor the manager to the answer
 * being tested, and the report would then measure agreement with a number they
 * had already read rather than an independent judgement.
 *
 * THE VERDICT IS NULL UNTIL THERE IS DATA. Spec §3: `overallTrustworthy` is null
 * until there is data, "never a fabricated verdict". A system that declared its
 * own scorer trustworthy on zero samples would be worse than one with no gate.
 */

/** The five dimensions a human can calibrate. The computed ones are excluded. */
export const JUDGED_DIMENSIONS = ['opener', 'objection', 'tone', 'close', 'next_step'] as const;
export type JudgedDimension = (typeof JUDGED_DIMENSIONS)[number];

/** Spec: a dimension whose mean absolute difference is at or under this is trustworthy. */
export const TRUST_THRESHOLD = 1.5;

export const DIMENSION_LABEL: Record<string, string> = {
  opener: 'Opener',
  objection: 'Objection handling',
  tone: 'Tone',
  close: 'Close',
  next_step: 'Next step',
};

export type Scores = Partial<Record<JudgedDimension, number>>;

export type DimensionReport = {
  dimension: string;
  n: number;
  /**
   * NULL when the dimension has no scores, mirroring the web's own type.
   *
   * Same lesson as `trustworthy` below: the server sends null and typing it as a
   * plain number let null flow into arithmetic, where `null * 10` is 0 — a
   * dimension nobody has scored reading as perfect agreement. It was safe only
   * because one branch happened to be checked first.
   */
  meanAbsDiff: number | null;
  /**
   * NULL WHEN UNMEASURED, mirroring the web's own type exactly.
   *
   * The server sends null for a dimension with no scores. Typing this as a plain
   * boolean made null read as false — "this dimension disagrees with you" — for
   * a dimension nobody has scored. The screen happened to check `n === 0` first
   * and so rendered correctly by accident; the type is now the thing that
   * guarantees it rather than the ordering of a condition.
   */
  trustworthy: boolean | null;
};

/** Is every judged dimension answered, and in range? */
export function scoresComplete(scores: Scores): boolean {
  return JUDGED_DIMENSIONS.every((d) => {
    const v = scores[d];
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;
  });
}

/** Which dimensions still need an answer — so the screen can say, not just disable. */
export function missingDimensions(scores: Scores): string[] {
  return JUDGED_DIMENSIONS.filter((d) => {
    const v = scores[d];
    return !(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10);
  });
}

/**
 * Is a dimension's agreement good enough?
 *
 * At or UNDER the threshold, matching the spec's "≤ 1.5". A strict comparison
 * would fail a dimension sitting exactly on the line the spec calls acceptable.
 *
 * THIS IS A MIRROR, NOT A SOURCE, and the distinction is load-bearing. The route
 * already sends `trustworthy` per dimension, and the screen renders THAT — this
 * function is deliberately not called on the render path. It exists so the app
 * states the rule it is mirroring in one readable place, and so a test can pin
 * the boundary.
 *
 * DO NOT WIRE IT INTO A SCREEN. The web repo had exactly this shape for the
 * points BANDS: a small local copy of a server rule, kept "for the chip", which
 * silently disagreed with the server for months because it skipped a rounding
 * step. A second implementation of somebody else's rule is a disagreement
 * waiting for a value that lands between the two.
 */
export function dimensionTrustworthy(meanAbsDiff: number | null): boolean {
  return (
    typeof meanAbsDiff === 'number' &&
    Number.isFinite(meanAbsDiff) &&
    meanAbsDiff <= TRUST_THRESHOLD
  );
}

/**
 * The overall verdict, or null when there is nothing to judge on.
 *
 * NULL IS A REAL ANSWER HERE and the most important one. "We have not measured
 * this yet" and "this scorer disagrees with you" are opposite conclusions, and
 * collapsing the first into `false` would tell a manager their AI is untrustworthy
 * when nobody has checked.
 */
export function overallTrustworthy(report: DimensionReport[]): boolean | null {
  // Mirrors the web: filter on the VERDICT being present, not on n, so the two
  // cannot disagree if the server ever reports a scored dimension differently.
  const measured = report.filter((r) => r.trustworthy !== null);
  if (measured.length === 0) return null;
  return measured.every((r) => r.trustworthy === true);
}

/** Plain English for a dimension's agreement. */
export function agreementLine(r: DimensionReport): string {
  // Checks the VALUE, not just the count: null is what the server actually
  // sends for an unmeasured dimension, and `null * 10` is 0 — which would read
  // as perfect agreement on something nobody has scored.
  if (r.n === 0 || r.meanAbsDiff === null) return 'Not scored yet';
  const diff = Math.round(r.meanAbsDiff * 10) / 10;
  return r.trustworthy === false
    ? `Off by ${diff} on average, across ${r.n} — needs a look`
    : `Agrees within ${diff} of you, across ${r.n}`;
}
