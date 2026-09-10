/**
 * Regression tests for Score Calibration (build spec 5.4).
 *
 * THE VERDICT MUST BE NULL WITH NO DATA. Spec section 3: `overallTrustworthy` is
 * null until there is data, "never a fabricated verdict". Collapsing that into
 * `false` tells a manager their AI scorer disagrees with them when nobody has
 * checked yet — the opposite conclusion from the truth, on the one screen whose
 * entire job is honesty about the scorer.
 *
 * AND THE THRESHOLD IS INCLUSIVE. The spec says "mean abs diff ≤ 1.5" is
 * trustworthy. A strict `<` fails a dimension sitting exactly on the line the
 * spec calls acceptable.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  agreementLine,
  dimensionTrustworthy,
  JUDGED_DIMENSIONS,
  missingDimensions,
  overallTrustworthy,
  scoresComplete,
  TRUST_THRESHOLD,
  type DimensionReport,
} from '@/lib/gamification/calibration';

/**
 * A dimension report as the SERVER sends it.
 *
 * `trustworthy` is passed in rather than computed by `dimensionTrustworthy`. It used to be computed, and that made
 * the fixtures agree with the function under test by construction: a downstream test could only ever confirm that
 * the app's own rule matches the app's own rule. The server is the authority for this field, so the fixtures state
 * it the way a payload does — as a value, not as a derivation.
 */
const rep = (
  dimension: string,
  n: number,
  meanAbsDiff: number,
  trustworthy: boolean | null = n === 0 ? null : meanAbsDiff <= 1.5,
): DimensionReport => ({ dimension, n, meanAbsDiff, trustworthy });

test('the five judged dimensions are exactly the spec\u2019s', () => {
  // The computed ones (talk_ratio, question_rate) are deterministic and excluded.
  assert.deepEqual([...JUDGED_DIMENSIONS], [
    'opener',
    'objection',
    'tone',
    'close',
    'next_step',
  ]);
});

test('NO DATA gives a null verdict, never "untrustworthy"', () => {
  assert.equal(overallTrustworthy([]), null);
  assert.equal(overallTrustworthy([rep('opener', 0, 0), rep('tone', 0, 0)]), null);
});

test('all dimensions agreeing is trustworthy', () => {
  assert.equal(overallTrustworthy([rep('opener', 4, 0.8), rep('tone', 3, 1.2)]), true);
});

test('one dimension out of line fails the whole verdict', () => {
  // A scorer trusted on four of five is not a trusted scorer.
  assert.equal(overallTrustworthy([rep('opener', 4, 0.8), rep('tone', 3, 2.4)]), false);
});

test('unmeasured dimensions are ignored rather than counted against', () => {
  assert.equal(overallTrustworthy([rep('opener', 4, 0.5), rep('tone', 0, 0)]), true);
});

test('the threshold is INCLUSIVE at 1.5', () => {
  assert.equal(dimensionTrustworthy(TRUST_THRESHOLD), true);
  assert.equal(dimensionTrustworthy(1.51), false);
  assert.equal(dimensionTrustworthy(0), true);
});

test('a non-finite difference is not trustworthy', () => {
  assert.equal(dimensionTrustworthy(Number.NaN), false);
});

test('a submission needs every dimension, in range and whole', () => {
  const full = { opener: 7, objection: 6, tone: 6, close: 5, next_step: 6 };
  assert.equal(scoresComplete(full), true);
  assert.equal(scoresComplete({ ...full, close: undefined }), false);
  assert.equal(scoresComplete({ ...full, close: 11 }), false);
  assert.equal(scoresComplete({ ...full, close: -1 }), false);
  assert.equal(scoresComplete({ ...full, close: 5.5 }), false);
});

test('zero is a legitimate score', () => {
  // A rep who did not open at all scores 0, and refusing that would force a
  // manager to inflate it.
  assert.equal(scoresComplete({ opener: 0, objection: 0, tone: 0, close: 0, next_step: 0 }), true);
});

test('the screen can SAY which dimensions are missing, not merely disable', () => {
  assert.deepEqual(missingDimensions({ opener: 7, tone: 6 }), [
    'objection',
    'close',
    'next_step',
  ]);
  assert.deepEqual(
    missingDimensions({ opener: 7, objection: 6, tone: 6, close: 5, next_step: 6 }),
    [],
  );
});

test('an unmeasured dimension says so rather than showing a zero difference', () => {
  assert.match(agreementLine(rep('opener', 0, 0)), /not scored yet/i);
  assert.ok(!/0/.test(agreementLine(rep('opener', 0, 0))));
});

test('a poor agreement is flagged for a look', () => {
  assert.match(agreementLine(rep('tone', 5, 2.4)), /needs a look/i);
  assert.ok(!/needs a look/i.test(agreementLine(rep('tone', 5, 0.9))));
});

test('an unmeasured dimension arrives as NULL, not false', () => {
  // The web types it `boolean | null` and sends null for n === 0. A plain
  // boolean here would read null as false — "this dimension disagrees with you"
  // about a dimension nobody has scored.
  const r = rep('opener', 0, 0);
  assert.equal(r.trustworthy, null);
  assert.equal(overallTrustworthy([r]), null);
});

test('a NULL mean difference never reads as perfect agreement', () => {
  // The server sends null for an unmeasured dimension. `null * 10` is 0, so a
  // number-typed field would have rendered "agrees within 0 of you" about a
  // dimension nobody has scored — the most confident possible statement built
  // on no data at all.
  const r: DimensionReport = {
    dimension: 'opener',
    n: 0,
    meanAbsDiff: null,
    trustworthy: null,
  };
  assert.match(agreementLine(r), /not scored yet/i);
  assert.equal(dimensionTrustworthy(null), false);
});

test('a null difference with a non-zero count is still refused', () => {
  // Defensive: if the two fields ever disagree, the VALUE decides, not the count.
  const r: DimensionReport = {
    dimension: 'tone',
    n: 4,
    meanAbsDiff: null,
    trustworthy: null,
  };
  assert.match(agreementLine(r), /not scored yet/i);
});

test('the SERVER decides trustworthiness — the app renders what it is sent', () => {
  // The rule this pins is "do not recompute someone else's verdict". Given a report whose `trustworthy` flag
  // disagrees with what the app's own mirrored threshold would say, the overall verdict must follow the SERVER.
  // The web repo had the opposite shape for the points bands — a small local copy kept "for the chip" that
  // silently disagreed for months — and this is the same failure one step earlier.
  const serverSaysNo = rep('opener', 10, 0.2, false); // well inside the threshold, but the server said no
  assert.equal(dimensionTrustworthy(0.2), true, 'the mirrored rule would say yes');
  assert.equal(overallTrustworthy([serverSaysNo]), false, 'the app must not overrule the server');

  const serverSaysYes = rep('opener', 10, 9.9, true); // far outside it, but the server said yes
  assert.equal(dimensionTrustworthy(9.9), false);
  assert.equal(overallTrustworthy([serverSaysYes]), true);
});

test('a dimension the server SCORED but could not judge is left out of the verdict', () => {
  // The filter is on the verdict being present, not on n, and the difference is only visible for this row:
  // n > 0 with trustworthy null — the server looked and could not say. Counting it would drag the overall verdict
  // to false, which reads as "your scorer disagrees with you" when the truth is "we could not tell for that one".
  const unjudgeable = rep('tone', 5, null as unknown as number, null);
  const good = rep('opener', 10, 0.2, true);

  assert.equal(overallTrustworthy([good, unjudgeable]), true, 'an unjudgeable dimension must not fail the verdict');
  assert.equal(overallTrustworthy([unjudgeable]), null, 'nothing judgeable at all is null, not false');
});
