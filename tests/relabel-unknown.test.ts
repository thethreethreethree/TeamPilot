import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SOLO_SPEAKER_ID, isUnlabelled, speakersFromTranscript } from '../src/lib/audio/relabel-unknown';
import type { TranscriptSegment } from '../src/types/backend';

/**
 * relabel-unknown — the question a rep can answer about a call this phone never uploaded.
 *
 * The server sweep recovers a dropped recording and saves its words as `unknown`. Nothing
 * on the device knows that call exists, so the picker's usual source is empty and the rep
 * would see a transcript with no speakers and no way to fix it. These lock the rebuild.
 */

const seg = (over: Partial<TranscriptSegment>): TranscriptSegment => ({
  id: 'x',
  session_id: 's1',
  speaker: 'unknown',
  text: 'A line of speech.',
  seq: 0,
  source: null,
  spoken_at: null,
  created_at: '2026-09-10T07:52:00.000Z',
  ...over,
});

test('an all-unknown transcript is the case that needs asking about', () => {
  assert.equal(isUnlabelled([seg({ seq: 0 }), seg({ seq: 1 })]), true);
});

test('an EMPTY transcript is not asked about — there is nothing to attribute yet', () => {
  // The screen has its own "still transcribing" state for this. Offering a voice question
  // with no voices in it would ask the rep about nothing.
  assert.equal(isUnlabelled([]), false);
});

test('a transcript with even ONE attributed turn is never re-asked', () => {
  // The server refuses to change an attributed transcript, so asking would invite a tap
  // that 409s — and a question the system will not honour teaches the rep to ignore it.
  assert.equal(isUnlabelled([seg({ seq: 0, speaker: 'agent' }), seg({ seq: 1 })]), false);
  assert.equal(isUnlabelled([seg({ seq: 0, speaker: 'customer' }), seg({ seq: 1 })]), false);
});

test('the rebuilt question carries exactly one voice', () => {
  // A server-saved `unknown` transcript is by construction the case where two voices could
  // not be separated, so there is one voice to ask about and the question is a binary.
  const speakers = speakersFromTranscript([
    seg({ seq: 0, text: 'Morning, I am from Elostate.' }),
    seg({ seq: 1, text: 'How much is it?' }),
  ]);
  assert.deepEqual(speakers, [
    { speakerId: SOLO_SPEAKER_ID, sample: 'Morning, I am from Elostate.' },
  ]);
});

test('the sample skips blank lines — the rep must have words to judge by', () => {
  const speakers = speakersFromTranscript([
    seg({ seq: 0, text: '   ' }),
    seg({ seq: 1, text: 'So what I do is knock a few doors on this street.' }),
  ]);
  assert.equal(speakers?.[0]?.sample, 'So what I do is knock a few doors on this street.');
});

test('a transcript of nothing but blank lines still asks, with an empty sample', () => {
  // Honest rather than clever: there IS an unattributed transcript, so the question stands.
  // An invented sample would put words in the rep's mouth to help them answer.
  const speakers = speakersFromTranscript([seg({ seq: 0, text: '  ' })]);
  assert.deepEqual(speakers, [{ speakerId: SOLO_SPEAKER_ID, sample: '' }]);
});

test('nothing is asked about a transcript that already has an answer', () => {
  assert.equal(speakersFromTranscript([seg({ seq: 0, speaker: 'agent' })]), null);
  assert.equal(speakersFromTranscript([]), null);
});
