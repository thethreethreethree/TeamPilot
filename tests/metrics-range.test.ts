/**
 * The custom window on the door numbers, and the way the server will lie about it.
 *
 * Measured against production, 10 September: a REVERSED range and a MALFORMED
 * date both return 200 with `period:"day"`, `range:null` and today's figures.
 * The spec says the endpoint validates both. It does not.
 *
 * So the dangerous case is not an error — it is eight doors from today, captioned
 * as ten days' work. These tests pin both guards: do not send a bad range, and do
 * not believe an answer that did not echo the range back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RANGE_NOT_HONOURED,
  echoMatchesRange,
  isCalendarDay,
  isSendableRange,
  rangeLabel,
  rangeProblem,
  rangeQuery,
} from '@/lib/doors/metrics-range';

const RANGE = { from: '2026-08-25', to: '2026-09-04' };

test('a well-formed window in order is sendable', () => {
  assert.equal(rangeProblem('2026-08-25', '2026-09-04'), null);
  assert.equal(isSendableRange('2026-08-25', '2026-09-04'), true);
  // One day is a legitimate window, not a reversed one.
  assert.equal(rangeProblem('2026-09-04', '2026-09-04'), null);
});

test('a reversed window is caught here, because the server will NOT catch it', () => {
  assert.equal(rangeProblem('2026-09-04', '2026-08-25'), 'reversed');
  assert.equal(isSendableRange('2026-09-04', '2026-08-25'), false);
});

test('half a window is "incomplete", which is not an error', () => {
  // The ordinary state between opening the picker and choosing the second date.
  assert.equal(rangeProblem('2026-08-25', null), 'incomplete');
  assert.equal(rangeProblem(null, '2026-09-04'), 'incomplete');
  assert.equal(rangeProblem('', ''), 'incomplete');
});

test('a date the calendar does not have is rejected', () => {
  // Matches the pattern, is not a day. A silently shifted date moves a rep's
  // window without telling them.
  assert.equal(isCalendarDay('2026-02-31'), false);
  assert.equal(isCalendarDay('2026-13-01'), false);
  assert.equal(isCalendarDay('26-09-04'), false);
  assert.equal(isCalendarDay('2026-09-04'), true);
  assert.equal(rangeProblem('2026-02-31', '2026-09-04'), 'malformed');
});

test('an answer that did not echo the range is NOT accepted', () => {
  // This is the exact production response to a reversed range.
  const todayInstead = { period: 'day', range: null, kpi: { doorsKnocked: 8 } };
  assert.equal(echoMatchesRange(todayInstead, RANGE), false);
});

test('an answer echoing a DIFFERENT window is not accepted either', () => {
  const other = { period: 'custom', range: { from: '2026-01-01', to: '2026-01-31' } };
  assert.equal(echoMatchesRange(other, RANGE), false);
});

test('the matching answer is accepted', () => {
  const good = { period: 'custom', range: { from: '2026-08-25', to: '2026-09-04' } };
  assert.equal(echoMatchesRange(good, RANGE), true);
});

test('a malformed or absent payload is never mistaken for a match', () => {
  for (const p of [null, undefined, {}, 'nope', { period: 'custom' }, { period: 'custom', range: {} }]) {
    assert.equal(echoMatchesRange(p, RANGE), false, `accepted ${JSON.stringify(p)}`);
  }
});

test('the refusal copy says the numbers are NOT being shown', () => {
  // The alternative is captioning today's figures with the window the rep asked
  // for, which is the failure this whole module exists to prevent.
  assert.match(RANGE_NOT_HONOURED, /not being shown/);
});

test('the query is encoded, and the label is human', () => {
  assert.equal(rangeQuery(RANGE), 'from=2026-08-25&to=2026-09-04');
  assert.equal(rangeLabel(RANGE, (iso) => iso.slice(5)), '08-25 to 09-04');
});
