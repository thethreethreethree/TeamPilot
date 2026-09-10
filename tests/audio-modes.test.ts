/**
 * The audio session flags, held still.
 *
 * THIS IS A GATE FOR A BUG THAT ALREADY SHIPPED. A rep switching to another app
 * mid-call came back to a recording that had stopped, because
 * `allowsBackgroundRecording` was never set and expo-audio's
 * `OnAppEntersBackground` calls `pauseAllRecorders()` unless it is true. The
 * screen set `shouldPlayInBackground` instead — which guards PLAYERS — and the
 * comment beside it said that was the one that mattered.
 *
 * Nothing failed. No error, no crash, no lost file. A type-checker cannot see it
 * (both flags are valid booleans) and a green build cannot see it (the app runs
 * perfectly until somebody switches apps). The only thing that can is a test that
 * names the flag and refuses to let it go false.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CALL_AUDIO_MODE,
  ENROLL_AUDIO_MODE,
  RELEASED_AUDIO_MODE,
} from '@/lib/audio/audio-modes';

test('a call keeps recording when the rep switches to another app', () => {
  // The flag this whole file exists for. Without it expo-audio pauses the
  // recorder the instant the app is backgrounded, silently.
  assert.equal(CALL_AUDIO_MODE.allowsBackgroundRecording, true);
});

test('the playback flag is NOT mistaken for the recording one', () => {
  // They guard different halves of the module. Setting only shouldPlayInBackground
  // is exactly the bug: playback survives, the recorder does not.
  assert.equal(CALL_AUDIO_MODE.shouldPlayInBackground, true);
  assert.equal(CALL_AUDIO_MODE.allowsBackgroundRecording, true);
  assert.notEqual(
    CALL_AUDIO_MODE.shouldPlayInBackground,
    undefined,
    'both flags are needed; neither substitutes for the other',
  );
});

test('a call records on a phone that is on silent, which every rep\'s is', () => {
  assert.equal(CALL_AUDIO_MODE.allowsRecording, true);
  assert.equal(CALL_AUDIO_MODE.playsInSilentMode, true);
});

test('an enrollment take does NOT keep recording in the background', () => {
  // The opposite decision to a call, on purpose: a seven-second read of one line
  // is meaningless if the rep walks away, and continuing would be recording them
  // for nothing.
  assert.equal(CALL_AUDIO_MODE.allowsBackgroundRecording, true);
  assert.ok(!ENROLL_AUDIO_MODE.allowsBackgroundRecording);
  assert.equal(ENROLL_AUDIO_MODE.allowsRecording, true);
});

test('releasing the session gives back the background slot too', () => {
  // expo-audio's mode fields default to false on every call, so releasing the
  // microphone releases the background slot with it. Holding either after a
  // recording is over affects other apps and the next recording.
  assert.equal(RELEASED_AUDIO_MODE.allowsRecording, false);
  assert.ok(!RELEASED_AUDIO_MODE.allowsBackgroundRecording);
  assert.ok(!RELEASED_AUDIO_MODE.shouldPlayInBackground);
});
