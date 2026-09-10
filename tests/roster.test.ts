/**
 * Regression tests for "who is in this topic".
 *
 * THE FAILURE GUARDED HERE is a teammate silently vanishing.
 *
 * `namesFor` returns only profiles that have a usable full_name. Building the
 * roster from that map alone drops anybody whose name is missing — so a rep
 * reads four names in a five-person room and says something frank believing they
 * know the audience. Somebody who cannot be named is still in the room, and is
 * counted and said.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRoster, rosterLine } from '@/lib/chat/roster';

const names = new Map([
  ['u1', 'Dana Ellis'],
  ['u2', 'Ben Cole'],
]);

test('an unnameable participant is COUNTED, never dropped', () => {
  // The whole point.
  const r = buildRoster(['u1', 'u2', 'u9'], names, null);
  assert.equal(r.unnamed, 1);
  assert.match(rosterLine(r), /1 other person/);
});

test('two unnameable participants read as plural', () => {
  const r = buildRoster(['u1', 'u8', 'u9'], names, null);
  assert.equal(r.unnamed, 2);
  assert.match(rosterLine(r), /2 other people/);
});

test('you are named first, and not twice', () => {
  const r = buildRoster(['u1', 'u2'], names, 'u1');
  assert.equal(r.includesYou, true);
  assert.deepEqual(r.names, ['You', 'Ben Cole']);
  assert.equal(r.names.filter((n) => n === 'Dana Ellis').length, 0);
});

test('the others are alphabetical, so the order never implies rank', () => {
  const r = buildRoster(['u1', 'u2'], names, null);
  assert.deepEqual(r.names, ['Ben Cole', 'Dana Ellis']);
});

test('a duplicate participant id is counted once', () => {
  const r = buildRoster(['u1', 'u1', 'u2'], names, null);
  assert.equal(r.names.length, 2);
  assert.equal(r.unnamed, 0);
});

test('you alone still reads sensibly', () => {
  const r = buildRoster(['u1'], names, 'u1');
  assert.match(rosterLine(r), /You/);
  assert.ok(!/other/.test(rosterLine(r)));
});

test('an empty topic says so rather than showing a bare label', () => {
  assert.match(rosterLine(buildRoster([], names, null)), /Nobody is in this topic yet/);
});

test('a blank name counts as unnameable rather than an empty entry', () => {
  const r = buildRoster(['u1', 'u3'], new Map([['u1', 'Dana Ellis'], ['u3', '   ']]), null);
  assert.deepEqual(r.names, ['Dana Ellis']);
  assert.equal(r.unnamed, 1);
});

test('empty ids are ignored', () => {
  const r = buildRoster(['', 'u1'], names, null);
  assert.deepEqual(r.names, ['Dana Ellis']);
  assert.equal(r.unnamed, 0);
});
