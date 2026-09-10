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

/**
 * `awaiting-voice` — the state added on 10 September, when recovery started saving a
 * dropped call's words as `unknown`. Before it, such a call had a transcript, so this
 * said "ready" and the card offered a debrief that would come back blank: every coaching
 * engine filters on `speaker === 'agent'`, so an unattributed transcript reads as empty
 * to all of them.
 */

test('an entirely unattributed transcript is waiting on the rep, not ready', () => {
  assert.equal(debriefAvailability(true, 12, 12), 'awaiting-voice');
});

test('a transcript with even ONE attributed turn is ready', () => {
  // The server 409s an attributed transcript, so asking again would send the rep at a
  // question that cannot be answered — and the engines can already read this one.
  assert.equal(debriefAvailability(true, 12, 11), 'ready');
});

test('a caller that does not know the count gets exactly the old behaviour', () => {
  // Defaulted to 0. Omitting it must never withhold a debrief that is perfectly ready.
  assert.equal(debriefAvailability(true, 12), 'ready');
});

test('an unattributed count cannot conjure a transcript that is not there', () => {
  assert.equal(debriefAvailability(true, 0, 5), 'awaiting-transcript');
  assert.equal(debriefAvailability(false, 0, 5), 'no-recording');
});

test('the waiting-on-a-voice copy points at the answer, and never reads as a failure', () => {
  const title = unavailableTitle('awaiting-voice');
  const body = unavailableBody('awaiting-voice');
  assert.equal(title, 'Waiting on one answer');
  // It must say the words are safe — a rep who reads "no debrief" as "my call was lost"
  // is the exact misreading this module was written to stop.
  assert.match(body, /already saved/);
  assert.doesNotMatch(body, /error|failed|problem/i);
});
