/**
 * Regression tests for the KPI presenter.
 *
 * The failure this exists to prevent is not a crash — it is a confidently wrong
 * number. The server's rate metrics are ALREADY multiplied by 100
 * (`round1((sold / opps.length) * 100)` in TeamPilot's compute.ts), so a
 * presenter that "helpfully" scales a rate would show a 42% conversion rate as
 * 4200%, and one that assumed dollars were cents would show $1,500 as $15. The
 * app has already had one 100x bug of exactly that shape.
 *
 * The second thing guarded here is the Understanding Gate: a metric the server
 * gated must NEVER render as a number. `value: null` means "not enough evidence
 * to say", and printing 0 there is the app inventing a fact.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildKpiView, formatValue, formatChange, readableKey } from '@/lib/kpi-view';
import type { KpiResponse, MetricResult } from '@/types/backend';

const m = (value: number | null, over: Partial<MetricResult> = {}): MetricResult => ({
  value,
  sampleSize: 12,
  gated: value === null,
  sourceSessionIds: ['a', 'b'],
  ...over,
});

const res = (over: Partial<KpiResponse> = {}): KpiResponse =>
  ({
    sessionCount: 12,
    minSessions: 5,
    scope: 'self',
    metrics: {},
    deltas: {},
    sessions: {},
    ...over,
  }) as KpiResponse;

const find = (v: ReturnType<typeof buildKpiView>, key: string) =>
  [...v.headline, ...v.rest].find((r) => r.key === key);

/* ── units ─────────────────────────────────────────────────────────────── */

test('a rate is shown as the server sent it, never scaled again', () => {
  const v = buildKpiView(res({ metrics: { conversionRate: m(42.5) } }));
  assert.equal(find(v, 'conversionRate')?.display, '42.5%');
});

test('money is dollars, not cents', () => {
  const v = buildKpiView(res({ metrics: { revenue: m(1500) } }));
  assert.equal(find(v, 'revenue')?.display, '$1,500');
});

test('large money reads with separators', () => {
  const v = buildKpiView(res({ metrics: { revenue: m(1234567.5) } }));
  assert.equal(find(v, 'revenue')?.display, '$1,234,567.5');
});

test('each known unit gets its own shape', () => {
  assert.equal(formatValue(2, 'ratio'), '2');
  assert.equal(formatValue(18.5, 'minutes'), '18.5 min');
  assert.equal(formatValue(1, 'days'), '1 day');
  assert.equal(formatValue(9, 'days'), '9 days');
  assert.equal(formatValue(3.4, 'perDay'), '3.4 a day');
  assert.equal(formatValue(72, 'score'), '72 / 100');
  assert.equal(formatValue(1.8, 'count'), '1.8');
});

/* ── the Understanding Gate ────────────────────────────────────────────── */

test('a gated metric shows nothing, never a zero', () => {
  const v = buildKpiView(res({ metrics: { closeRate: m(null, { sampleSize: 3 }) } }));
  const row = find(v, 'closeRate');
  assert.equal(row?.display, null);
  assert.equal(row?.gated, true);
});

test('a gated metric says how many more calls it needs', () => {
  const v = buildKpiView(res({ metrics: { closeRate: m(null, { sampleSize: 3 }) } }));
  assert.equal(find(v, 'closeRate')?.needed, 2);
});

test('a null value with gated false is still treated as building', () => {
  // Trusting `gated` alone would print "null" if the server ever disagreed with
  // itself. The value is what decides whether a number can be shown.
  const v = buildKpiView(res({ metrics: { closeRate: m(null, { gated: false }) } }));
  assert.equal(find(v, 'closeRate')?.display, null);
  assert.equal(find(v, 'closeRate')?.gated, true);
});

test('a non-finite value is treated as building, not printed', () => {
  const v = buildKpiView(res({ metrics: { winLossRatio: m(Infinity, { gated: false }) } }));
  assert.equal(find(v, 'winLossRatio')?.display, null);
});

test('a gated metric carries no change line', () => {
  const v = buildKpiView(
    res({ metrics: { closeRate: m(null, { sampleSize: 2 }) }, deltas: { closeRate: 9 } }),
  );
  assert.equal(find(v, 'closeRate')?.change, null);
});

test('the whole board is building below the session minimum', () => {
  assert.equal(buildKpiView(res({ sessionCount: 3, minSessions: 5 })).building, true);
  assert.equal(buildKpiView(res({ sessionCount: 5, minSessions: 5 })).building, false);
});

/* ── change lines ──────────────────────────────────────────────────────── */

test('a change is stated with its direction and its unit', () => {
  assert.equal(formatChange(4.2, 'percent'), 'Up 4.2% since the first half of these calls');
  assert.equal(formatChange(-4.2, 'percent'), 'Down 4.2% since the first half of these calls');
  assert.equal(formatChange(-250, 'money'), 'Down $250 since the first half of these calls');
});

test('no change is said plainly rather than as zero', () => {
  assert.equal(formatChange(0, 'percent'), 'Unchanged since the first half of these calls');
});

test('a missing change produces no line at all', () => {
  assert.equal(formatChange(null, 'percent'), null);
  assert.equal(formatChange(undefined, 'percent'), null);
});

test('a change never carries a verdict', () => {
  // A11: the board mirrors. Any word that grades the rep is a defect here.
  const words = ['good', 'bad', 'poor', 'great', 'improv', 'worse', 'better', 'well done'];
  for (const delta of [12, -12, 0]) {
    const line = (formatChange(delta, 'percent') ?? '').toLowerCase();
    for (const w of words) assert.ok(!line.includes(w), `"${line}" contains "${w}"`);
  }
});

/* ── unknown metrics ───────────────────────────────────────────────────── */

test('a metric this build has never seen is shown, not dropped', () => {
  // The server owns the metric set. Hiding an unrecognised key would mean the
  // rep is measured on something the app silently refuses to show them.
  const v = buildKpiView(res({ metrics: { brandNewThing: m(7) } }));
  const row = find(v, 'brandNewThing');
  assert.ok(row, 'the unknown metric survived');
  assert.equal(row?.label, 'Brand new thing');
  assert.equal(row?.display, '7');
});

test('key names are made readable without inventing a unit', () => {
  assert.equal(readableKey('l3_question_rate'), 'Question rate');
  assert.equal(readableKey('avgDealSize'), 'Avg deal size');
  assert.equal(readableKey('objectionsPerSession'), 'Objections per session');
});

/* ── ordering and grouping ─────────────────────────────────────────────── */

test('headline metrics come in reading order, not response order', () => {
  const v = buildKpiView(
    res({
      metrics: {
        revenue: m(100),
        conversionRate: m(40),
        closeRate: m(50),
      },
    }),
  );
  assert.deepEqual(v.headline.map((r) => r.key), ['conversionRate', 'closeRate', 'revenue']);
});

test('non-headline metrics are ordered stably by their label', () => {
  const v = buildKpiView(
    res({ metrics: { l3_tone: m(70), consistency: m(80), cueAcceptanceRate: m(60) } }),
  );
  assert.deepEqual(
    v.rest.map((r) => r.label),
    ['Call-to-call steadiness', 'Coach cues acted on', 'Tone'],
  );
});

test('a headline metric the server did not send is simply absent', () => {
  const v = buildKpiView(res({ metrics: { conversionRate: m(40) } }));
  assert.equal(v.headline.length, 1);
  assert.equal(find(v, 'revenue'), undefined);
});

test('an empty response produces an empty board rather than throwing', () => {
  const v = buildKpiView(res({ sessionCount: 0, metrics: {}, deltas: {} }));
  assert.equal(v.building, true);
  assert.deepEqual(v.headline, []);
  assert.deepEqual(v.rest, []);
});

test('a company-scoped response is reported as company', () => {
  assert.equal(buildKpiView(res({ scope: 'company' })).scope, 'company');
});

/* ── the missing-outcome count ─────────────────────────────────────────── */

test('sessions with no outcome are counted', () => {
  // The explanation behind a board that will not fill in: these feed neither
  // conversion rate nor close rate, and nothing else on screen says so.
  const v = buildKpiView(
    res({
      sessions: {
        a: { label: 'A', startedAt: '2026-09-01T10:00:00Z', outcome: 'sold' },
        b: { label: 'B', startedAt: '2026-09-01T11:00:00Z', outcome: null },
        c: { label: 'C', startedAt: '2026-09-01T12:00:00Z', outcome: null },
      },
    }),
  );
  assert.equal(v.unscoredCount, 2);
});

test('a fully scored set reports none missing', () => {
  const v = buildKpiView(
    res({
      sessions: {
        a: { label: 'A', startedAt: '2026-09-01T10:00:00Z', outcome: 'sold' },
        b: { label: 'B', startedAt: '2026-09-01T11:00:00Z', outcome: 'no_sale' },
      },
    }),
  );
  assert.equal(v.unscoredCount, 0);
});

test('an empty outcome string counts as missing', () => {
  // "" is not an outcome. Treating it as one would hide a session that feeds
  // nothing behind a count that says everything is fine.
  const v = buildKpiView(
    res({
      sessions: { a: { label: 'A', startedAt: '2026-09-01T10:00:00Z', outcome: '' } },
    }),
  );
  assert.equal(v.unscoredCount, 1);
});

test('no sessions map at all is not a crash', () => {
  const v = buildKpiView(res({ sessions: undefined as never }));
  assert.equal(v.unscoredCount, 0);
});

/* ── the calls behind a number ─────────────────────────────────────────── */

test('a metric carries the calls that produced it', () => {
  const v = buildKpiView(
    res({
      metrics: { conversionRate: m(40, { sourceSessionIds: ['a', 'b'] }) },
      sessions: {
        a: { label: 'Rowan & Co', startedAt: '2026-09-01T10:00:00Z', outcome: 'sold' },
        b: { label: 'The corner unit', startedAt: '2026-09-02T10:00:00Z', outcome: 'no_sale' },
      },
    }),
  );
  const row = find(v, 'conversionRate');
  assert.equal(row?.sources.length, 2);
  assert.equal(row?.sources[0].label, 'The corner unit', 'newest first');
});

test('an id the response does not describe is dropped, not shown blank', () => {
  // A row with no name and no date is not evidence, it is noise.
  const v = buildKpiView(
    res({
      metrics: { conversionRate: m(40, { sourceSessionIds: ['a', 'missing'] }) },
      sessions: { a: { label: 'A', startedAt: '2026-09-01T10:00:00Z', outcome: 'sold' } },
    }),
  );
  assert.deepEqual(find(v, 'conversionRate')?.sources.map((s) => s.id), ['a']);
});

test('the count still reports every id, including ones without detail', () => {
  // Otherwise the rep is told the metric used fewer calls than it did — a
  // quieter error than a blank row, and a worse one.
  const v = buildKpiView(
    res({
      metrics: { conversionRate: m(40, { sourceSessionIds: ['a', 'missing'] }) },
      sessions: { a: { label: 'A', startedAt: '2026-09-01T10:00:00Z', outcome: 'sold' } },
    }),
  );
  assert.equal(find(v, 'conversionRate')?.sourceCount, 2);
  assert.equal(find(v, 'conversionRate')?.sources.length, 1);
});

test('a metric with no sources has an empty list, not undefined', () => {
  const v = buildKpiView(res({ metrics: { conversionRate: m(40, { sourceSessionIds: [] }) } }));
  assert.deepEqual(find(v, 'conversionRate')?.sources, []);
});

test('a gated metric still lists what it has so far', () => {
  // "Building, from these 3 calls" is more useful than "building" alone — it
  // tells the rep the measurement is working and what it is waiting on.
  const v = buildKpiView(
    res({
      metrics: { closeRate: m(null, { sampleSize: 3, sourceSessionIds: ['a'] }) },
      sessions: { a: { label: 'A', startedAt: '2026-09-01T10:00:00Z', outcome: 'sold' } },
    }),
  );
  assert.equal(find(v, 'closeRate')?.sources.length, 1);
});
