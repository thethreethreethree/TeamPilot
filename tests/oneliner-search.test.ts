/**
 * The doorstep search: a rep has seconds and one hand.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  ONELINER_SEARCH_THRESHOLD,
  filterLines,
  matchesLine,
  type SearchableLine,
} from '@/lib/oneliner-search';

const line = (over: Partial<SearchableLine> = {}): SearchableLine => ({
  correctLine: 'I hear you — most people say that before they see the numbers.',
  whyItWorks: 'Acknowledges the objection without arguing.',
  context: 'Prospect said it was too expensive',
  sessionLabel: 'Maple Street, no. 14',
  outcome: 'Sold',
  ...over,
});

test('a rep finds the line by the objection they actually heard', () => {
  assert.equal(matchesLine(line(), 'expensive'), true);
});

test('the search reads every field the rep can see on the row', () => {
  // A search that ignored a visible word would make a rep think their own line
  // had gone missing.
  assert.equal(matchesLine(line(), 'numbers'), true, 'the line itself');
  assert.equal(matchesLine(line(), 'arguing'), true, 'why it works');
  assert.equal(matchesLine(line(), 'maple'), true, 'the call it came from');
  assert.equal(matchesLine(line(), 'sold'), true, 'the outcome');
});

test('every word must match, so a second word narrows and never widens', () => {
  // `some` would make the result WORSE as the rep types more, and they would
  // learn to stop typing.
  assert.equal(matchesLine(line(), 'expensive maple'), true);
  assert.equal(matchesLine(line(), 'expensive rejected'), false);
});

test('word order does not matter — it is the same question', () => {
  assert.equal(matchesLine(line(), 'expensive numbers'), true);
  assert.equal(matchesLine(line(), 'numbers expensive'), true);
});

test('an empty or blank search shows everything, never nothing', () => {
  // A rep who clears the box must get their list back, not a blank screen.
  const rows = [line(), line({ correctLine: 'another' })];
  assert.equal(filterLines(rows, '').length, 2);
  assert.equal(filterLines(rows, '   ').length, 2);
});

test('the matcher itself treats an empty query as "everything matches"', () => {
  // filterLines short-circuits before reaching the matcher, so without this the
  // matcher's own empty-query branch is never exercised — it could be inverted
  // and every test above would still pass.
  assert.equal(matchesLine(line(), ''), true);
  assert.equal(matchesLine(line(), '   '), true);
});

test('a line with missing fields is still searchable, never a crash', () => {
  const sparse = line({ whyItWorks: null, context: null, sessionLabel: null, outcome: null });
  assert.equal(matchesLine(sparse, 'numbers'), true);
  assert.equal(matchesLine(sparse, 'expensive'), false);
});

test('search is case-insensitive both ways', () => {
  assert.equal(matchesLine(line(), 'EXPENSIVE'), true);
  assert.equal(matchesLine(line({ context: 'TOO EXPENSIVE' }), 'expensive'), true);
});

test('filtering keeps the server order rather than re-ranking', () => {
  const a = line({ correctLine: 'price one' });
  const b = line({ correctLine: 'price two' });
  const c = line({ correctLine: 'unrelated', context: null, whyItWorks: null });
  assert.deepEqual(
    filterLines([a, b, c], 'price').map((l) => l.correctLine),
    ['price one', 'price two'],
  );
});

test('the threshold is low enough that a real playbook gets a search box', () => {
  assert.ok(ONELINER_SEARCH_THRESHOLD <= 10);
});
