import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  needsVoiceAnswer,
  voiceQuestionWording,
  VOICE_QUESTION_CHIP,
  VOICE_QUESTION_CHIP_OTHER,
} from '../src/lib/voice-question';

/**
 * voice-question — the row chip that tells a rep a recovered call is waiting on one tap.
 *
 * The chip's whole job is to be TRUE. A rep who taps it and is refused by the server
 * learns to ignore the chip, and then the one call that really was waiting rides in
 * behind the false ones.
 */

test('a fully unattributed transcript is waiting on the rep', () => {
  assert.equal(needsVoiceAnswer({ segments: 12, unattributed: 12 }), true);
});

test('a transcript with even ONE real turn is not asked about again', () => {
  // /label-transcript 409s a transcript that already has an agent turn, so a chip here
  // would invite a tap the server refuses.
  assert.equal(needsVoiceAnswer({ segments: 12, unattributed: 11 }), false);
});

test('a fully attributed transcript shows nothing', () => {
  assert.equal(needsVoiceAnswer({ segments: 12, unattributed: 0 }), false);
});

test('a call with no transcript yet is not a voice question', () => {
  // It is still being transcribed, or it was never recovered. Either way the answer is
  // not "tap here" — the screen has its own waiting state for it.
  assert.equal(needsVoiceAnswer({ segments: 0, unattributed: 0 }), false);
});

test('an UNKNOWN count is never a chip — a failed side query must not invent one', () => {
  // Null is not zero. A chip that appears because a query failed is worse than no chip:
  // it teaches the rep that the chip means nothing.
  assert.equal(needsVoiceAnswer({ segments: null, unattributed: 3 }), false);
  assert.equal(needsVoiceAnswer({ segments: 5, unattributed: null }), false);
  assert.equal(needsVoiceAnswer({ segments: null, unattributed: null }), false);
});

test('a nonsense negative count is refused rather than treated as data', () => {
  assert.equal(needsVoiceAnswer({ segments: -1, unattributed: -1 }), false);
});

/**
 * Who is reading changes what the row is allowed to say (A18).
 *
 * A manager scrolling a rep's calls sees this one carrying no coaching scores. With no
 * label the absence reads as the rep having done badly; with the rep's own wording it
 * reads as them having ignored an instruction. Neither is true, and a manager cannot
 * answer it anyway — the route is owner-only.
 */

test("the rep's own call gets the words that ask them to act", () => {
  const w = voiceQuestionWording({ segments: 5, unattributed: 5 }, true);
  assert.equal(w?.chip, VOICE_QUESTION_CHIP);
  assert.match(w!.spoken, /say which voice is yours/);
});

test("somebody else's call names the SYSTEM's state, never the rep's", () => {
  const w = voiceQuestionWording({ segments: 5, unattributed: 5 }, false);
  assert.equal(w?.chip, VOICE_QUESTION_CHIP_OTHER);
  // It must not tell a manager to do a thing the server will refuse them.
  assert.doesNotMatch(w!.spoken, /your voice|which voice is yours/);
  // And it must explain the blank scores, so the gap is not read as poor performance.
  assert.match(w!.spoken, /could not tell which voice/);
});

test('a call that needs nothing says nothing, to either reader', () => {
  assert.equal(voiceQuestionWording({ segments: 5, unattributed: 0 }, true), null);
  assert.equal(voiceQuestionWording({ segments: 5, unattributed: 0 }, false), null);
});

test('an unknown count says nothing, to either reader', () => {
  assert.equal(voiceQuestionWording({ segments: null, unattributed: 5 }, true), null);
  assert.equal(voiceQuestionWording({ segments: 5, unattributed: null }, false), null);
});
