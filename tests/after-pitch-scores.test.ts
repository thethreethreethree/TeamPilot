/**
 * Regression tests for the rep's own After Pitch scores.
 *
 * The card's header has always said ABSENT SCORES ARE NOT SHOWN AS ZERO, and
 * these pin that down. A bar at zero on a category nobody measured tells a rep
 * they failed at something that was never assessed — the same lie the skills
 * view guards, where an unmeasured skill is "not yet" and never a D.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { barWidth, hasScores, readableScores } from '@/lib/after-pitch-scores';

test('real scores read back in the order the coach returned them', () => {
  // Not sorted: these arrive as a considered sequence, and re-ordering would
  // present the coach's emphasis as something the phone chose.
  const s = readableScores([
    { label: 'Opening', score: 80 },
    { label: 'Discovery', score: 40 },
  ]);
  assert.deepEqual(s.map((x) => x.label), ['Opening', 'Discovery']);
});

test('a category with no number is DROPPED, not drawn at zero', () => {
  assert.deepEqual(readableScores([{ label: 'Close' }]), []);
});

test('a number with no label is dropped', () => {
  // Nothing could be explained to the rep about it.
  assert.deepEqual(readableScores([{ score: 70 }]), []);
  assert.deepEqual(readableScores([{ label: '   ', score: 70 }]), []);
});

test('a real zero IS kept — it is a measurement, not an absence', () => {
  const s = readableScores([{ label: 'Objections', score: 0 }]);
  assert.equal(s.length, 1);
  assert.equal(s[0].score, 0);
});

test('a non-finite score is dropped rather than rendered', () => {
  assert.deepEqual(readableScores([{ label: 'X', score: Number.NaN }]), []);
});

test('stripped scores (a manager view) mean no section at all', () => {
  assert.equal(hasScores([]), false);
  assert.equal(hasScores(undefined), false);
});

test('one real score is enough to show the section', () => {
  assert.equal(hasScores([{ label: 'Opening', score: 55 }]), true);
});

test('a bar never paints outside its track', () => {
  assert.equal(barWidth(140), 100);
  assert.equal(barWidth(-5), 0);
  assert.equal(barWidth(55), 55);
});

test('an out-of-range score keeps its real NUMBER even though the bar clamps', () => {
  // A 120 is somebody's bug; a full bar would hide it.
  const s = readableScores([{ label: 'Opening', score: 120 }]);
  assert.equal(s[0].score, 120);
  assert.equal(barWidth(s[0].score), 100);
});

test('a non-array payload does not crash', () => {
  assert.deepEqual(readableScores(undefined), []);
});
