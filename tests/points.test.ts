/**
 * Regression tests for a rep's own points.
 *
 * THE LEDGER IS APPEND-ONLY (migration 0242, enforced by a raising trigger), so
 * a correction is a NEW row with negative points, never an edit. Every rule here
 * follows from that, and the obvious implementations all break on it:
 *
 *   counting ROWS as sessions turns one corrected session into two — which
 *   inflates the session count a rep sees AND deflates their average, so being
 *   corrected once appears to drag down an average it has nothing to do with;
 *
 *   plotting each ROW on the trend shows a sudden dive to a negative number
 *   that never happened to them.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BANDS,
  STRONG_SESSION_POINTS,
  bandFor,
  bandLabel,
  summarise,
  trendPoints,
} from '@/lib/gamification/points';

const row = (sessionId: string | null, points: number, at: string, band: string | null = null) => ({
  sessionId,
  points,
  band,
  createdAt: at,
});

test('the total is the SUM, corrections included', () => {
  const s = summarise([row('a', 80, '1'), row('a', -20, '2'), row('b', 60, '3')]);
  assert.equal(s.total, 120);
});

test('a corrected session is still ONE session', () => {
  // Counting rows would say 2, inflating the count and deflating the average.
  const s = summarise([row('a', 80, '1'), row('a', -20, '2')]);
  assert.equal(s.sessions, 1);
  assert.equal(s.average, 60);
});

test('a manual correction with no session counts to the total but not the count', () => {
  const s = summarise([row('a', 80, '1'), row(null, -10, '2')]);
  assert.equal(s.total, 70);
  assert.equal(s.sessions, 1);
  assert.equal(s.average, 70);
});

test('no sessions gives a NULL average, never a zero', () => {
  // A zero average reads as "you scored nothing", which is a different claim
  // from "you have not been scored yet".
  const s = summarise([]);
  assert.equal(s.average, null);
  assert.equal(s.total, 0);
  assert.equal(s.sessions, 0);
});

test('only-corrections gives a null average rather than dividing by zero', () => {
  const s = summarise([row(null, -5, '1')]);
  assert.equal(s.sessions, 0);
  assert.equal(s.average, null);
  assert.equal(s.total, -5);
});

test('a non-numeric points value is skipped, not counted as zero', () => {
  const s = summarise([row('a', 50, '1'), row('b', Number.NaN, '2')]);
  assert.equal(s.total, 50);
  assert.equal(s.sessions, 1);
});

test('the average is rounded to one place, not left as a long float', () => {
  const s = summarise([row('a', 10, '1'), row('b', 10, '2'), row('c', 11, '3')]);
  assert.equal(s.average, 10.3);
});

test('the trend folds a correction INTO its session rather than plotting a dive', () => {
  const t = trendPoints([row('a', 80, '2026-01-01'), row('a', -20, '2026-03-01')]);
  assert.equal(t.length, 1);
  assert.equal(t[0].points, 60);
});

test('a corrected session keeps its ORIGINAL place in the chart', () => {
  // Otherwise a correction months later jumps an old session to the end.
  const t = trendPoints([
    row('a', 50, '2026-01-01'),
    row('b', 70, '2026-02-01'),
    row('a', -10, '2026-06-01'),
  ]);
  assert.deepEqual(t.map((x) => x.sessionId), ['a', 'b']);
  assert.equal(t[0].points, 40);
});

test('the trend is oldest first', () => {
  const t = trendPoints([row('b', 1, '2026-05-01'), row('a', 2, '2026-01-01')]);
  assert.deepEqual(t.map((x) => x.sessionId), ['a', 'b']);
});

test('rows with no session never reach the trend', () => {
  assert.deepEqual(trendPoints([row(null, 40, '2026-01-01')]), []);
});

test('a band the phone does not know is shown, not swallowed', () => {
  assert.equal(bandLabel('elite'), 'Elite');
  assert.equal(bandLabel('needs_coaching'), 'Needs coaching');
  assert.equal(bandLabel('brand_new_band'), 'brand_new_band');
  assert.equal(bandLabel(null), null);
});

test('the band boundaries match the build spec exactly', () => {
  // Section 1 of GAMIFICATION-MOBILE-BUILD-SPEC.md, contiguous over 0-100.
  assert.equal(bandFor(100), 'elite');
  assert.equal(bandFor(90), 'elite');
  assert.equal(bandFor(89), 'strong');
  assert.equal(bandFor(80), 'strong');
  assert.equal(bandFor(79), 'solid');
  assert.equal(bandFor(60), 'solid');
  assert.equal(bandFor(59), 'developing');
  assert.equal(bandFor(40), 'developing');
  assert.equal(bandFor(39), 'needs_coaching');
  assert.equal(bandFor(0), 'needs_coaching');
});

test('an ABSENT score has no band, rather than the worst one', () => {
  // A rep with no scored session has not been judged badly — they have not been
  // judged. Same rule as the skills grade, which draws no letter rather than a D.
  assert.equal(bandFor(null), null);
  assert.equal(bandFor(undefined), null);
  assert.equal(bandFor(Number.NaN), null);
});

test('the band is taken from the ROUNDED score, as the spec says', () => {
  assert.equal(bandFor(89.5), 'elite');
  assert.equal(bandFor(89.4), 'strong');
});

test('a score outside 0-100 clamps rather than inventing a band', () => {
  assert.equal(bandFor(140), 'elite');
  assert.equal(bandFor(-20), 'needs_coaching');
});

test('the strong-session threshold is 80', () => {
  assert.equal(STRONG_SESSION_POINTS, 80);
  assert.equal(bandFor(STRONG_SESSION_POINTS), 'strong');
});

test('every band has a label, and the labels match the spec', () => {
  assert.deepEqual(
    BANDS.map((b) => bandLabel(b.band)),
    ['Elite', 'Strong', 'Solid', 'Developing', 'Needs coaching'],
  );
});
