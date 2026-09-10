/**
 * The rule that stops the app inventing an authentication failure for a call
 * that simply has nothing in it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  debriefAvailability,
  unavailableBody,
  unavailableTitle,
} from '@/lib/debrief-availability';

test('the reported session — no audio, no transcript — is "no recording", not a failure', () => {
  // Session 912db3f2 "test the system", 18 August: audio_asset_url null,
  // recording_saved false, zero segments. The app blamed the app's sign-in.
  assert.equal(debriefAvailability(false, 0), 'no-recording');
});

test('audio present but no transcript yet is a WAIT, not an absence', () => {
  // Telling this rep there is no recording would read as a lost call.
  assert.equal(debriefAvailability(true, 0), 'awaiting-transcript');
});

test('any transcript at all means the debrief can be made', () => {
  assert.equal(debriefAvailability(true, 1), 'ready');
  // Segments without a stored audio asset still count: the transcript is what
  // the debrief is written from, and it is right here.
  assert.equal(debriefAvailability(false, 12), 'ready');
});

test('a nonsense count falls back on the audio rather than claiming readiness', () => {
  assert.equal(debriefAvailability(false, Number.NaN), 'no-recording');
  assert.equal(debriefAvailability(true, Number.NaN), 'awaiting-transcript');
});

test('neither message reads as an error, and neither offers a pointless retry', () => {
  for (const state of ['no-recording', 'awaiting-transcript'] as const) {
    const body = unavailableBody(state);
    assert.ok(!/sign-in|sign in again|not accept|refused|error|went wrong/i.test(body), `${state} reads as an auth or error failure`);
    assert.ok(unavailableTitle(state).length > 0);
  }
  // The one that can never change must not tell a rep to try again.
  assert.ok(!/try again/i.test(unavailableBody('no-recording')), 'it offered a retry that cannot help');
  // The one that can change must say how to check.
  assert.match(unavailableBody('awaiting-transcript'), /check again/i);
});

test('the no-recording message still tells a rep the call counts', () => {
  assert.match(unavailableBody('no-recording'), /counts this call in your numbers/);
});
