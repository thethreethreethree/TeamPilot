/**
 * Regression tests for the topic list's All / Open / Closed filter.
 *
 * THE THING THAT WOULD GO WRONG QUIETLY is 'archived'.
 *
 * The status column allows three values and the filter offers two. An archived
 * topic therefore matches neither Open nor Closed — the same as the web, which
 * is the point, because a rep must not find different topics under the same word
 * on their phone than on their desktop.
 *
 * What must NOT happen is that being invisible. If Open says 4 and Closed says 2
 * while All says 7, the seventh is accounted for on screen. Otherwise a rep
 * flipping between two filters concludes a conversation was deleted.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FILTER,
  emptyFilterMessage,
  filterLabel,
  filterTopics,
  hasUncountedTopics,
  topicCounts,
} from '@/lib/chat/topic-filter';

const t = (id: string, status: 'open' | 'closed' | 'archived') => ({ id, status });

const SET = [
  t('a', 'open'),
  t('b', 'closed'),
  t('c', 'open'),
  t('d', 'archived'),
];

test('the default shows everything', () => {
  // A filter that hides things by default is how somebody concludes a
  // conversation was deleted.
  assert.equal(DEFAULT_FILTER, 'all');
  assert.equal(filterTopics(SET, DEFAULT_FILTER).length, 4);
});

test('open shows only open', () => {
  assert.deepEqual(filterTopics(SET, 'open').map((x) => x.id), ['a', 'c']);
});

test('closed shows only closed', () => {
  assert.deepEqual(filterTopics(SET, 'closed').map((x) => x.id), ['b']);
});

test('an archived topic is in neither Open nor Closed — same as the web', () => {
  assert.ok(!filterTopics(SET, 'open').some((x) => x.id === 'd'));
  assert.ok(!filterTopics(SET, 'closed').some((x) => x.id === 'd'));
  // ...but it is never lost.
  assert.ok(filterTopics(SET, 'all').some((x) => x.id === 'd'));
});

test('the counts make an uncounted topic visible', () => {
  // The whole mitigation. Without this the archived topic is a silent gap.
  const counts = topicCounts(SET);
  assert.deepEqual(counts, { all: 4, open: 2, closed: 1 });
  assert.equal(hasUncountedTopics(counts), true);
});

test('nothing uncounted means nothing is said', () => {
  const counts = topicCounts([t('a', 'open'), t('b', 'closed')]);
  assert.equal(hasUncountedTopics(counts), false);
});

test('an empty list counts as zero rather than throwing', () => {
  assert.deepEqual(topicCounts([]), { all: 0, open: 0, closed: 0 });
  assert.equal(hasUncountedTopics(topicCounts([])), false);
  assert.deepEqual(filterTopics([], 'open'), []);
});

test('filtering does not mutate the list it was given', () => {
  const input = [...SET];
  filterTopics(input, 'open');
  assert.equal(input.length, 4);
});

test('an empty filter result explains itself', () => {
  // A blank screen with a filter on reads as broken.
  assert.match(emptyFilterMessage('open') ?? '', /closed off/i);
  assert.match(emptyFilterMessage('closed') ?? '', /nothing has been closed/i);
  // "All" empty is the real empty state, which the screen already handles.
  assert.equal(emptyFilterMessage('all'), null);
});

test('every filter has a label', () => {
  assert.equal(filterLabel('all'), 'All');
  assert.equal(filterLabel('open'), 'Open');
  assert.equal(filterLabel('closed'), 'Closed');
});
