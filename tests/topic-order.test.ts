/**
 * Regression tests for the chat list's ordering.
 *
 * TWO FAILURES, and neither of them throws.
 *
 * The first is sorting IN PLACE. `Array.prototype.sort` mutates, so sorting the
 * array React is already holding produces the same reference — React sees no
 * change and does not re-render. The list silently keeps its old order, and the
 * bug looks like "sorting doesn't work" rather than "state was mutated".
 *
 * The second is the FALLBACK. `lastMessageAt` is null in two very different
 * cases — a topic with nothing said in it, and a topic the rep is not in, whose
 * contents the policy hides entirely. Treating null as "very old" would bury
 * every topic a rep has not joined at the bottom of the list, including one
 * started ten minutes ago that they are meant to notice.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { activityAt, byActivity } from '@/lib/chat/topic-order';

const t = (id: string, createdAt: string, lastMessageAt: string | null = null) => ({
  id,
  createdAt,
  lastMessageAt,
});

test('a busy old topic beats a quiet new one', () => {
  const old = t('old', '2026-01-01T00:00:00Z', '2026-09-03T18:00:00Z');
  const fresh = t('fresh', '2026-09-02T00:00:00Z', null);
  assert.deepEqual(
    byActivity([fresh, old]).map((x) => x.id),
    ['old', 'fresh'],
  );
});

test('a topic with no messages falls back to when it was started', () => {
  assert.equal(activityAt(t('x', '2026-05-05T00:00:00Z', null)), '2026-05-05T00:00:00Z');
});

test('a topic the rep is NOT in is not buried', () => {
  // Its lastMessageAt is null because the policy hides its messages, not
  // because it is dead. A topic started an hour ago must still be near the top.
  const hidden = t('hidden', '2026-09-03T17:00:00Z', null);
  const mine = t('mine', '2026-01-01T00:00:00Z', '2026-09-03T09:00:00Z');
  assert.deepEqual(
    byActivity([mine, hidden]).map((x) => x.id),
    ['hidden', 'mine'],
  );
});

test('sorting returns a NEW array and leaves the original alone', () => {
  // Mutating in place gives React the same reference, so the reorder never
  // renders — the bug then reads as "sorting doesn't work".
  const input = [t('a', '2026-01-01T00:00:00Z'), t('b', '2026-09-01T00:00:00Z')];
  const before = input.map((x) => x.id);
  const sorted = byActivity(input);
  assert.notEqual(sorted, input);
  assert.deepEqual(input.map((x) => x.id), before, 'the input was mutated');
  assert.deepEqual(sorted.map((x) => x.id), ['b', 'a']);
});

test('newest activity is first, throughout', () => {
  const rows = [
    t('c', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z'),
    t('a', '2026-01-01T00:00:00Z', '2026-09-03T00:00:00Z'),
    t('d', '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
    t('b', '2026-01-01T00:00:00Z', '2026-08-01T00:00:00Z'),
  ];
  assert.deepEqual(
    byActivity(rows).map((x) => x.id),
    ['a', 'b', 'c', 'd'],
  );
});

test('identical timestamps do not throw or drop a row', () => {
  const rows = [t('a', '2026-09-01T00:00:00Z'), t('b', '2026-09-01T00:00:00Z')];
  assert.equal(byActivity(rows).length, 2);
});

test('an empty list is an empty list', () => {
  assert.deepEqual(byActivity([]), []);
});
