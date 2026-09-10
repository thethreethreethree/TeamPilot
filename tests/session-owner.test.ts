/**
 * Whose call a manager is looking at.
 *
 * The failure these guard against is not a missing label — it is a WRONG one.
 * Putting somebody else's name on a rep's own call, or "Unknown rep" on a row
 * whose name simply has not loaded, are both worse than the blank the screen had
 * before, because both read as a fact the app is asserting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isSomeoneElses, ownerLabel, ownerSpoken } from '@/lib/session-owner';

const ME = '7da30c76-6e9f-4cb1-9d55-7b20cbd5bb14';
const OTHER = '940ef40b-aae6-495d-9d66-93d037c41b7b';
const NAMES = new Map([[OTHER, 'Johns Ramos'], [ME, 'Moses Maniquiz']]);

test("a rep's own calls are never labelled — the same name on every row is noise", () => {
  assert.equal(isSomeoneElses(ME, ME), false);
  assert.equal(ownerLabel(ME, ME, NAMES), null);
});

test("another rep's call is named, which is the whole point", () => {
  assert.equal(isSomeoneElses(OTHER, ME), true);
  assert.equal(ownerLabel(OTHER, ME, NAMES), 'Johns Ramos');
});

test('an unloaded viewer id labels NOTHING, rather than labelling everything', () => {
  // The first frame after launch: sessions have arrived, the viewer's id has not.
  // Treating that as "not me" would put a stranger's name on the rep's own calls.
  assert.equal(isSomeoneElses(OTHER, null), false);
  assert.equal(isSomeoneElses(OTHER, ''), false);
  assert.equal(ownerLabel(OTHER, undefined, NAMES), null);
});

test('a missing agent id is not treated as somebody else', () => {
  assert.equal(isSomeoneElses(null, ME), false);
  assert.equal(isSomeoneElses('   ', ME), false);
});

test('a name that has not arrived shows nothing, never a placeholder', () => {
  // "Unknown rep" reads as data the app holds and got wrong. A blank reads as a
  // lookup still in flight, which is the truth.
  assert.equal(ownerLabel(OTHER, ME, new Map()), null);
  assert.equal(ownerLabel(OTHER, ME, new Map([[OTHER, '   ']])), null);
});

test('the spoken form is a phrase, not a bare name dropped into the sentence', () => {
  assert.equal(ownerSpoken('Johns Ramos'), 'recorded by Johns Ramos');
  assert.equal(ownerSpoken(null), '');
});
