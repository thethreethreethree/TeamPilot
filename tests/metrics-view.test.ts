/**
 * Regression tests for Today's Metrics.
 *
 * THE FAILURE BEING GUARDED IS A PHANTOM ZERO, and the web's own component says
 * why in its source: *"Only dims PRESENT in the data render (older pitches
 * scored under the v1 rubric lack talk_listen/questions — showing a phantom 0
 * would be a lie)."*
 *
 * A rep reading "Questions: 0 / 10" concludes they never ask questions and goes
 * and drills the wrong habit, when in truth that dimension was never measured on
 * their pitches at all. The distinction that makes this hard is that a REAL zero
 * must still render — so the filter has to test for PRESENCE, not truthiness,
 * and a `?? undefined` or a falsy check silently collapses the two.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMetricsView, SCORE_MAX, type Metrics } from '@/lib/doors/metrics-view';

function metrics(over: Partial<Metrics> = {}): Metrics {
  return {
    kpi: { doorsKnocked: 12, conversations: 4, sold: 1 },
    scores: { objection: 7, tone: 8 },
    focus: null,
    opportunities: [],
    ...over,
  };
}

test('a dimension that was never scored does not appear at all', () => {
  const v = buildMetricsView(metrics({ scores: { objection: 7 } }));
  assert.deepEqual(
    v.bars.map((b) => b.key),
    ['objection'],
  );
});

test('a REAL zero still renders — it is a measurement, not an absence', () => {
  // The whole difficulty of this rule in one case. A truthiness filter would
  // drop this and quietly tell the rep their weakest dimension does not exist.
  const v = buildMetricsView(metrics({ scores: { objection: 0, tone: 8 } }));
  const objection = v.bars.find((b) => b.key === 'objection');
  assert.ok(objection, 'a scored zero was dropped');
  assert.equal(objection?.value, 0);
  assert.equal(objection?.fraction, 0);
});

test('dimensions render in the founder’s order, not the object’s', () => {
  // Object key order follows insertion, which follows whatever the server
  // serialised. The chart must read the same way every time.
  const v = buildMetricsView(
    metrics({ scores: { close: 5, objection: 6, questions: 7 } }),
  );
  assert.deepEqual(
    v.bars.map((b) => b.key),
    ['objection', 'questions', 'close'],
  );
});

test('a bar’s fraction is clamped to the scale', () => {
  const v = buildMetricsView(metrics({ scores: { tone: 99, close: -5 } }));
  assert.equal(v.bars.find((b) => b.key === 'tone')?.fraction, 1);
  assert.equal(v.bars.find((b) => b.key === 'close')?.fraction, 0);
});

test('a non-numeric score is dropped rather than drawn as NaN', () => {
  const v = buildMetricsView(
    metrics({ scores: { objection: Number.NaN, tone: 8 } as Record<string, number> }),
  );
  assert.deepEqual(
    v.bars.map((b) => b.key),
    ['tone'],
  );
});

test('no scores at all is reported as such, not as an empty chart', () => {
  const v = buildMetricsView(metrics({ scores: {} }));
  assert.equal(v.noScores, true);
});

test('a failed load shows dashes, never zeros', () => {
  // Same rule as the home screen: a zero that is really a failure teaches a rep
  // to distrust every other number.
  const v = buildMetricsView(null);
  assert.deepEqual(
    v.kpi.map((k) => k.value),
    ['—', '—', '—'],
  );
  assert.equal(v.noScores, true);
});

test('sales is the emphasised figure, but never when it is zero', () => {
  assert.equal(buildMetricsView(metrics()).kpi.find((k) => k.key === 'sold')?.emphasis, true);
  const none = buildMetricsView(metrics({ kpi: { doorsKnocked: 9, conversations: 2, sold: 0 } }));
  // Outlining a zero draws the eye to nothing.
  assert.equal(none.kpi.find((k) => k.key === 'sold')?.emphasis, false);
});

test('a blank focus reads as no focus', () => {
  assert.equal(buildMetricsView(metrics({ focus: '   ' })).focus, null);
  assert.equal(buildMetricsView(metrics({ focus: 'Ask one more question' })).focus,
    'Ask one more question');
});

test('empty growth opportunities are dropped rather than rendered as blank lines', () => {
  const v = buildMetricsView(metrics({ opportunities: ['Slow down', '', '   ', 'Ask for the sale'] }));
  assert.deepEqual(v.opportunities, ['Slow down', 'Ask for the sale']);
});

test('every bar and figure speaks a full sentence', () => {
  const v = buildMetricsView(metrics({ scores: { tone: 8 } }));
  for (const b of v.bars) {
    assert.match(b.spoken, new RegExp(`out of ${SCORE_MAX}`));
  }
  for (const k of v.kpi) {
    // A screen reader hitting a bare number with no context is the failure.
    assert.ok(k.spoken.length > k.value.length, k.key);
  }
});

test("an all-time figure is grouped, not run together as digits", () => {
  // The All Time tab shows five-digit numbers for any working rep — 50 doors a
  // day is 12,500 a year. "12500" beside the Arena's "12,500" is one number
  // written two ways, two taps apart.
  const v = buildMetricsView(metrics({ kpi: { doorsKnocked: 12500, conversations: 3400, sold: 1200 } }));
  const byLabel = (want: string) => v.kpi.find((k) => k.label.toLowerCase().includes(want))?.value;
  assert.equal(byLabel('doors'), '12,500');
  assert.equal(byLabel('conversations'), '3,400');
  assert.equal(byLabel('sales'), '1,200');
});

test('a small figure is not decorated', () => {
  const v = buildMetricsView(metrics({ kpi: { doorsKnocked: 12, conversations: 4, sold: 1 } }));
  assert.equal(v.kpi.find((k) => k.label.toLowerCase().includes('doors'))?.value, '12');
});
