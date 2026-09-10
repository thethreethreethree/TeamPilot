/**
 * Regression tests for the rep's practice trend on the Training screen.
 *
 * "APPLIED" IS NOT "ATTEMPTED", and that distinction is the honesty of the whole
 * figure. A rep can drill a skill and never once reach it during the run — those
 * attempts carry no score. Rendering the missing score as 0 tells somebody their
 * close is failing when they have simply never got to the close.
 *
 * AND A DIRECTION NEEDS TWO POINTS. With one scored run there is nothing to
 * compare, and "holding" is a claim that nothing changed — which is not the same
 * as not knowing.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  focusLabel,
  hasPractice,
  practiceHeadline,
  practiceLines,
  type PracticeSummary,
} from '@/lib/practice-view';

const focus = (over: Partial<PracticeSummary['byFocus'][number]> = {}) => ({
  focus: 'objection_handling',
  attempts: 4,
  latest: 70,
  first: 50,
  trend: 'up' as const,
  ...over,
});

const summary = (over: Partial<PracticeSummary> = {}): PracticeSummary => ({
  totalAttempts: 4,
  appliedAttempts: 3,
  byFocus: [focus()],
  latest: 70,
  trend: 'up',
  ...over,
});

test('a skill never reached in a run shows an em dash, not a zero', () => {
  // The rep drilled it and never got there. Zero would say they did it badly.
  const [line] = practiceLines(summary({ byFocus: [focus({ latest: null, first: null })] }));
  assert.equal(line.score, '—');
  assert.match(line.spoken, /not yet reached/i);
});

test('a scored skill shows its latest score and direction', () => {
  const [line] = practiceLines(summary());
  assert.equal(line.score, '70');
  assert.equal(line.direction, 'going up');
});

test('one scored point claims NO direction', () => {
  // `first` is null, so there is nothing to compare against — even though the
  // server still labels a trend.
  const [line] = practiceLines(summary({ byFocus: [focus({ first: null, trend: 'flat' })] }));
  assert.equal(line.score, '70');
  assert.equal(line.direction, null, 'claimed a direction from a single point');
});

test('the headline never invents a score', () => {
  const h = practiceHeadline(summary({ latest: null, trend: null }));
  assert.match(h, /no score to show/i);
  assert.ok(!/\b0 out of 100\b/.test(h));
});

test('the headline says what is needed for a direction', () => {
  const h = practiceHeadline(summary({ trend: null }));
  assert.match(h, /one more scored run/i);
});

test('a full headline reads plainly', () => {
  assert.match(practiceHeadline(summary()), /4 practice runs.*70 out of 100.*going up/i);
});

test('runs are singular when there is one', () => {
  assert.match(practiceHeadline(summary({ totalAttempts: 1 })), /1 practice run\b/);
});

test('no practice at all shows nothing rather than an empty chart', () => {
  assert.equal(hasPractice(null), false);
  assert.equal(hasPractice(undefined), false);
  assert.equal(hasPractice(summary({ totalAttempts: 0 })), false);
  assert.equal(hasPractice(summary()), true);
});

test('focus keys read as English', () => {
  assert.equal(focusLabel('objection_handling'), 'Objection handling');
  assert.equal(focusLabel('close'), 'Close');
});
