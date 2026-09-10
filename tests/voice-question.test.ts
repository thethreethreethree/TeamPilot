import { test } from 'node:test';
import assert from 'node:assert/strict';

import { needsVoiceAnswer } from '../src/lib/voice-question';

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
