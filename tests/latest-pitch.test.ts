/**
 * Regression tests for the door log's "open my last pitch" shortcut.
 *
 * THE POINT OF THIS MODULE IS THE FALLBACK. A rep taps it at the end of a day of
 * knocking, and the two ways it can fail — no pitch recorded yet, and the read
 * failing — must both land them somewhere real. The web's version redirects to
 * the Pitch Performance list in both cases, because that list already has honest
 * empty and error states of its own.
 *
 * Sending them to a detail screen for a pitch id that does not exist would show
 * "this pitch is not available", which reads as though something they recorded
 * was lost.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { latestPitchTarget } from '@/lib/doors/latest-pitch';

test('a real pitch id opens that pitch', () => {
  const t = latestPitchTarget({ pitchId: 'abc-123' });
  assert.equal(t.kind, 'pitch');
  assert.equal(t.kind === 'pitch' && t.pitchId, 'abc-123');
});

test('no pitch yet falls back to the list, never a dead end', () => {
  assert.deepEqual(latestPitchTarget({ pitchId: null }), {
    kind: 'list',
    because: 'none-yet',
  });
});

test('a failed read ALSO falls back to the list', () => {
  // And is distinguished from "none yet", because they are different facts even
  // though they route the same way today.
  assert.deepEqual(latestPitchTarget({ failed: true }), {
    kind: 'list',
    because: 'unreadable',
  });
});

test('a failed read wins even if an id somehow came back', () => {
  // Fail closed: an id alongside an error is not trustworthy enough to navigate
  // a rep to.
  assert.equal(latestPitchTarget({ pitchId: 'abc', failed: true }).kind, 'list');
});

test('a blank or whitespace id is not treated as a pitch', () => {
  assert.equal(latestPitchTarget({ pitchId: '' }).kind, 'list');
  assert.equal(latestPitchTarget({ pitchId: '   ' }).kind, 'list');
});

test('a missing field is not a pitch', () => {
  assert.equal(latestPitchTarget({}).kind, 'list');
});
