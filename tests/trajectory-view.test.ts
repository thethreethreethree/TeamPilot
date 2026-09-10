/**
 * Regression tests for the trend view.
 *
 * The failures worth guarding here are all about drawing a shape that isn't
 * there:
 *
 *   - a month with too little evidence comes back null. Rendered as ZERO it
 *     becomes a crash in the chart, and a rep reads a quiet December as a
 *     collapse. Rendered as a straight line through it, the gap disappears and
 *     they read continuity that never happened.
 *   - a single data point has no range. Plotted naively it sits at full height
 *     and looks like a perfect score.
 *   - a delta against nothing is not a delta. "Up 12%" on a metric that had no
 *     previous month is an invented comparison.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTrendView, periodLabel, trendChange } from '@/lib/trajectory-view';
import type { MetricTrajectory, TrajectoryResponse } from '@/types/backend';

const point = (period: string, value: number | null, sampleSize = 10) => ({
  period,
  value,
  sampleSize,
});

const metric = (over: Partial<MetricTrajectory> = {}): MetricTrajectory => ({
  metric: 'conversionRate',
  layer: 1,
  points: [point('2026-01', 29), point('2026-02', 33), point('2026-03', 38)],
  latest: 38,
  previous: 33,
  delta: 5,
  monthsWithData: 3,
  ...over,
});

const res = (over: Partial<TrajectoryResponse> = {}): TrajectoryResponse => ({
  building: false,
  monthsCovered: 3,
  metrics: [metric()],
  ...over,
});

const row = (v: ReturnType<typeof buildTrendView>, name = 'conversionRate') =>
  v.rows.find((r) => r.metric === name);

/* ── months ────────────────────────────────────────────────────────────── */

test('a period renders as a month a person reads, not a code', () => {
  assert.equal(periodLabel('2026-03'), 'Mar 2026');
  assert.equal(periodLabel('2026-12'), 'Dec 2026');
});

test('the month label is built from the string, never from a Date', () => {
  // new Date('2026-03') parses as UTC midnight and renders as FEBRUARY west of
  // Greenwich. This project has already shipped that exact bug once, on the
  // session day headings.
  assert.equal(periodLabel('2026-01'), 'Jan 2026');
  assert.equal(periodLabel('2026-11'), 'Nov 2026');
});

test('an unparseable period is passed through rather than guessed', () => {
  assert.equal(periodLabel('not-a-month'), 'not-a-month');
  assert.equal(periodLabel('2026-13'), '2026-13');
});

/* ── null months ───────────────────────────────────────────────────────── */

test('a month with no value is a gap, not a zero', () => {
  const v = buildTrendView(
    res({
      metrics: [
        metric({ points: [point('2026-01', 29), point('2026-02', null), point('2026-03', 38)] }),
      ],
    }),
  );
  const points = row(v)!.points;
  assert.equal(points[1].display, null, 'no number is shown for it');
  assert.equal(points[1].fraction, null, 'and it is not plotted at zero');
});

test('a gap still keeps its place in the series', () => {
  // Dropping it would close the gap and show two adjacent months that were
  // three months apart.
  const v = buildTrendView(
    res({
      metrics: [
        metric({ points: [point('2026-01', 29), point('2026-02', null), point('2026-03', 38)] }),
      ],
    }),
  );
  assert.deepEqual(row(v)!.points.map((p) => p.period), ['2026-01', '2026-02', '2026-03']);
});

/* ── the shape of the line ─────────────────────────────────────────────── */

test('the series is scaled within its own range', () => {
  const v = buildTrendView(res());
  const f = row(v)!.points.map((p) => p.fraction);
  assert.equal(f[0], 0, 'the lowest month sits at the bottom');
  assert.equal(f[2], 1, 'the highest at the top');
  assert.ok(f[1]! > 0 && f[1]! < 1, 'and the middle between them');
});

test('a flat series sits mid-height, not at the top or the floor', () => {
  // It did not max out and it did not bottom out — it did not move.
  const v = buildTrendView(
    res({
      metrics: [
        metric({ points: [point('2026-01', 30), point('2026-02', 30)], latest: 30, previous: 30, delta: 0 }),
      ],
    }),
  );
  assert.deepEqual(row(v)!.points.map((p) => p.fraction), [0.5, 0.5]);
});

test('a single data point does not read as a perfect score', () => {
  const v = buildTrendView(
    res({
      metrics: [
        metric({ points: [point('2026-03', 38)], latest: 38, previous: null, delta: null, monthsWithData: 1 }),
      ],
    }),
  );
  assert.equal(row(v)!.points[0].fraction, 0.5, 'one point has no range to sit within');
});

/* ── the change line ───────────────────────────────────────────────────── */

test('a movement is stated with its direction and unit', () => {
  assert.equal(trendChange(metric({ delta: 5 }), 'percent'), 'Up 5% on the month before');
  assert.equal(trendChange(metric({ delta: -5 }), 'percent'), 'Down 5% on the month before');
});

test('no movement is said plainly rather than as zero', () => {
  assert.equal(trendChange(metric({ delta: 0 }), 'percent'), 'Level with the month before');
});

test('a delta against nothing produces no line at all', () => {
  // "Up 12%" on a metric with no previous month is an invented comparison.
  assert.equal(trendChange(metric({ delta: null, previous: null }), 'percent'), null);
});

test('a change never carries a verdict', () => {
  // A11: it mirrors. Any word grading the rep is a defect.
  const words = ['good', 'bad', 'poor', 'great', 'improv', 'worse', 'better', 'well'];
  for (const delta of [12, -12, 0]) {
    const line = (trendChange(metric({ delta }), 'percent') ?? '').toLowerCase();
    for (const w of words) assert.ok(!line.includes(w), `"${line}" contains "${w}"`);
  }
});

/* ── ordering and empties ──────────────────────────────────────────────── */

test('metrics that have never resolved sink to the bottom, not out of sight', () => {
  // A rep should see that a measurement exists and is still gathering — which
  // is different from it not existing.
  const v = buildTrendView(
    res({
      metrics: [
        metric({ metric: 'closeRate', monthsWithData: 0, latest: null, delta: null }),
        metric({ metric: 'conversionRate' }),
      ],
    }),
  );
  assert.deepEqual(v.rows.map((r) => r.metric), ['conversionRate', 'closeRate']);
  assert.equal(row(v, 'closeRate')!.building, true);
});

test('units match the KPI board so one metric never reads two ways', () => {
  const v = buildTrendView(res());
  assert.equal(row(v)!.latest, '38%', 'already multiplied by 100 on the server');
  assert.equal(row(v)!.label, 'Conversion rate');
});

test('an empty response is a building view rather than a crash', () => {
  const v = buildTrendView({ building: true, monthsCovered: 0, metrics: [] });
  assert.equal(v.building, true);
  assert.deepEqual(v.rows, []);
});

test('a metric the app has never seen is still shown, readably', () => {
  const v = buildTrendView(res({ metrics: [metric({ metric: 'brandNewThing' })] }));
  assert.equal(row(v, 'brandNewThing')!.label, 'Brand new thing');
});
