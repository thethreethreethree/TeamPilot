/**
 * The month grid behind the from/to picker.
 *
 * A calendar's bugs are the ones a screenshot cannot show: a month whose first
 * day is a Sunday, a February in a leap year, a grid that quietly drops the 31st,
 * a timezone that renders August's last day as September's first cell. Every one
 * of those is an answer, and this is where the answers are pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEEKDAYS,
  dayLabel,
  dayNumber,
  daySpoken,
  daysInMonth,
  isoOf,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
} from '@/lib/doors/calendar';

const flat = (year: number, month: number) => monthGrid(year, month).flat();
const days = (year: number, month: number) => flat(year, month).filter((c) => c !== null);

test('every day of the month is in the grid exactly once, and nothing else is', () => {
  // The 31st is the cell a hand-written grid drops, and February is where a
  // hand-written length table is wrong.
  for (const [y, m, n] of [
    [2026, 1, 31],
    [2026, 2, 28],
    [2024, 2, 29], // leap
    [2000, 2, 29], // leap by the 400 rule
    [1900, 2, 28], // NOT leap, by the 100 rule
    [2026, 9, 30],
    [2026, 12, 31],
  ] as const) {
    const got = days(y, m);
    assert.equal(got.length, n, `${y}-${m} had ${got.length} days`);
    assert.equal(got[0], isoOf(y, m, 1));
    assert.equal(got[n - 1], isoOf(y, m, n));
    assert.equal(new Set(got).size, n, `${y}-${m} repeated a day`);
    assert.equal(daysInMonth(y, m), n);
  }
});

test('the week starts on Monday, so the 1st lands under the right heading', () => {
  // 1 September 2026 is a Tuesday: one leading blank, then the 1st in column 2.
  const first = monthGrid(2026, 9)[0];
  assert.equal(first[0], null);
  assert.equal(first[1], '2026-09-01');
  assert.equal(WEEKDAYS[1], 'Tue');

  // A month starting on a SUNDAY is the Monday-first trap: six blanks, not none.
  // 1 February 2026 is a Sunday.
  const feb = monthGrid(2026, 2)[0];
  assert.deepEqual(feb.slice(0, 6), [null, null, null, null, null, null]);
  assert.equal(feb[6], '2026-02-01');
});

test('every row is exactly seven cells, so the grid cannot go ragged', () => {
  for (const [y, m] of [
    [2026, 2],
    [2026, 9],
    [2024, 2],
    [2026, 12],
  ] as const) {
    for (const week of monthGrid(y, m)) assert.equal(week.length, 7, `${y}-${m} row was ragged`);
  }
});

test('a UTC-noon anchor keeps the first cell in the right month', () => {
  // Built at midnight and read with local getters, a negative-offset device
  // renders 2026-09-01 as 31 August. Noon cannot cross either midnight.
  assert.equal(days(2026, 9)[0], '2026-09-01');
  assert.equal(days(2026, 1)[0], '2026-01-01');
});

test('moving a month rolls the year in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 9, 0), { year: 2026, month: 9 });
  assert.deepEqual(shiftMonth(2026, 9, -12), { year: 2025, month: 9 });
});

test('a month is read back from the date the rep already chose', () => {
  assert.deepEqual(monthOf('2026-09-04'), { year: 2026, month: 9 });
  assert.equal(monthOf(''), null);
  assert.equal(monthOf('4 September'), null);
  assert.equal(monthOf(null), null);
});

test('the labels are words a rep reads, and a screen reader says the weekday', () => {
  assert.equal(monthLabel(2026, 9), 'September 2026');
  // MATCHED, NOT EQUALLED, and the difference is a real portability trap: Node's
  // ICU renders en-GB September as "Sept" and Hermes on a phone may render
  // "Sep". Pinning one spelling would pin the laptop's ICU and pass while the
  // device disagreed. What has to be true is day, month and year, in that order.
  assert.match(dayLabel('2026-09-04'), /^4 Sept?\.? 2026$/);
  assert.equal(dayNumber('2026-09-04'), '4');
  // The spoken form names the weekday, because "4" alone tells a screen-reader
  // user nothing about where in the week they are.
  assert.match(daySpoken('2026-09-04'), /Friday/);
  assert.equal(daySpoken('nope'), '');
  assert.equal(dayLabel('nope'), '');
});

test('the ISO the API is sent is zero-padded, never "2026-9-4"', () => {
  assert.equal(isoOf(2026, 9, 4), '2026-09-04');
  assert.equal(isoOf(2026, 12, 31), '2026-12-31');
});
