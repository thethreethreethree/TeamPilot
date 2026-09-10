/**
 * Regression tests for finding one pitch among two hundred.
 *
 * TWO RULES, both of which the obvious implementation gets wrong.
 *
 * The outcome must match its LABEL, not its database value. A rep types
 * "go back", never "go_back", so matching the raw value alone makes the most
 * obvious search anybody tries return nothing.
 *
 * And every word must match, not any. Matching ANY word means typing a second
 * word makes the results WORSE — the opposite of what typing more is for.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { filterPitches, matchesPitch } from '@/lib/pitch-search';

const LABEL: Record<string, string> = {
  sold: 'Sold',
  go_back: 'Go back',
  not_interested: 'Not interested',
  // The label shares NO word with the raw value, which is what makes the
  // label-matching test below able to fail. 'go_back' vs 'Go back' cannot prove
  // anything: the raw value already contains both words a rep would type.
  unknown: 'Outcome not recorded',
};
const label = (o: string) => LABEL[o] ?? o;

const pitch = (name: string, outcome: string, summary: string | null = null) => ({
  name,
  outcome,
  summary,
});

test('an empty query matches everything', () => {
  assert.equal(matchesPitch(pitch('14 Oak St', 'sold'), '', label), true);
  assert.equal(matchesPitch(pitch('14 Oak St', 'sold'), '   ', label), true);
});

test('the address matches', () => {
  assert.equal(matchesPitch(pitch('14 Oak St', 'sold'), 'oak', label), true);
  assert.equal(matchesPitch(pitch('14 Oak St', 'sold'), 'elm', label), false);
});

test('the outcome matches by its LABEL, the way a rep types it', () => {
  // Deliberately uses a label with no word in common with its raw value.
  // "go back" vs "go_back" would pass even WITHOUT label matching, because the
  // raw value already contains both words — a test that cannot fail.
  assert.equal(matchesPitch(pitch('9 Elm', 'unknown'), 'not recorded', label), true);
  assert.equal(matchesPitch(pitch('9 Elm', 'go_back'), 'go back', label), true);
});

test('the raw outcome value still matches too', () => {
  assert.equal(matchesPitch(pitch('9 Elm', 'go_back'), 'go_back', label), true);
});

test('the summary is searched, because it is on the screen', () => {
  const p = pitch('9 Elm', 'sold', 'Lost them on price, recovered with the warranty.');
  assert.equal(matchesPitch(p, 'warranty', label), true);
});

test('EVERY word must match, so a second word narrows', () => {
  const oakSold = pitch('14 Oak St', 'sold');
  const elmSold = pitch('9 Elm St', 'sold');
  assert.equal(matchesPitch(oakSold, 'oak sold', label), true);
  // Matching ANY word would return this too, making the search worse the more
  // the rep types.
  assert.equal(matchesPitch(elmSold, 'oak sold', label), false);
});

test('search is case-insensitive both ways', () => {
  assert.equal(matchesPitch(pitch('14 OAK St', 'sold'), 'oak', label), true);
  assert.equal(matchesPitch(pitch('14 oak st', 'sold'), 'OAK', label), true);
});

test('a pitch with no summary does not crash the match', () => {
  assert.equal(matchesPitch(pitch('14 Oak St', 'sold', null), 'oak', label), true);
});

test('an unknown outcome falls back to its raw value rather than vanishing', () => {
  assert.equal(matchesPitch(pitch('9 Elm', 'brand_new'), 'brand_new', label), true);
});

test('filtering preserves the original order', () => {
  const rows = [pitch('A st', 'sold'), pitch('B st', 'sold'), pitch('C st', 'sold')];
  assert.deepEqual(
    filterPitches(rows, 'st', label).map((r) => r.name),
    ['A st', 'B st', 'C st'],
  );
});

test('an empty query returns the same list, untouched', () => {
  const rows = [pitch('A', 'sold')];
  assert.equal(filterPitches(rows, '', label), rows);
});
