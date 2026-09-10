/**
 * Regression tests for the chat poll's "did anything change?" decision.
 *
 * THE BUG BEING GUARDED compared LENGTHS.
 *
 *   prev.length === rows.length ? prev : rows
 *
 * Counts collide. Delete one message and add another between two polls and the
 * count is identical — so the new message is thrown away and the rep, sitting
 * with the thread open, never sees it. Silent, intermittent, and from their side
 * indistinguishable from nobody having replied.
 *
 * The second test group is about a phone in a pocket for a nine-hour shift: the
 * author names were re-fetched on every single poll, for an answer that almost
 * never changes.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasChanged, needsNames } from '@/lib/chat/poll';

const m = (id: string, createdAt: string, authorId: string | null = 'u1') => ({
  id,
  createdAt,
  authorId,
});

test('the first load is always a change', () => {
  assert.equal(hasChanged(null, []), true);
  assert.equal(hasChanged(null, [m('a', '1')]), true);
});

test('an identical list is not a change', () => {
  const list = [m('a', '1'), m('b', '2')];
  assert.equal(hasChanged(list, [...list]), false);
});

test('a new message is a change', () => {
  assert.equal(hasChanged([m('a', '1')], [m('a', '1'), m('b', '2')]), true);
});

test('ONE REPLACED FOR ONE is a change, though the count is identical', () => {
  // The exact failure. A length check calls this "no change" and the rep never
  // sees the message that arrived.
  const before = [m('a', '1'), m('b', '2')];
  const after = [m('a', '1'), m('c', '3')];
  assert.equal(hasChanged(before, after), true);
});

test('the same id at a different time is a change', () => {
  assert.equal(hasChanged([m('a', '1')], [m('a', '2')]), true);
});

test('an empty list stays empty without churning', () => {
  assert.equal(hasChanged([], []), false);
});

test('a message being deleted is a change', () => {
  assert.equal(hasChanged([m('a', '1'), m('b', '2')], [m('a', '1')]), true);
});

test('names are not re-fetched when every author is already known', () => {
  // A request every ten seconds, all shift, for an answer that has not moved.
  const known = new Set(['u1', 'u2']);
  assert.equal(needsNames([m('a', '1', 'u1'), m('b', '2', 'u2')], known), false);
});

test('names ARE re-fetched when somebody new speaks', () => {
  assert.equal(needsNames([m('a', '1', 'u9')], new Set(['u1'])), true);
});

test('a message with no author needs no lookup', () => {
  // System messages carry no author and must not trigger a fetch.
  assert.equal(needsNames([m('a', '1', null)], new Set()), false);
});

test('an empty thread needs no lookup', () => {
  assert.equal(needsNames([], new Set()), false);
});
