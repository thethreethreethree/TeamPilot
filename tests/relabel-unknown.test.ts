import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SOLO_SPEAKER_ID,
  isUnlabelled,
  startSecondsFor,
  attributionFromTranscript,
} from '../src/lib/audio/relabel-unknown';
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
  assert.equal(isUnlabelled([seg({ seq: 0, speaker: 'agent' }), seg({ seq: 1 })]), false);
  assert.equal(isUnlabelled([seg({ seq: 0, speaker: 'customer' }), seg({ seq: 1 })]), false);
});

test('the offset is read back out of spoken_at, so answering keeps the timing', () => {
  // THE REGRESSION THIS EXISTS TO STOP. /label-transcript rebuilds spoken_at from the
  // startSeconds it is sent. A payload without them nulls every timestamp — so a naive
  // answer would destroy the pace timing in the act of making the call coachable.
  assert.equal(
    startSecondsFor('2026-09-10T07:52:00.000Z', '2026-09-10T07:54:09.000Z'),
    129,
  );
});

test('an unknown time is never a zero', () => {
  // Zero is a real position — the opening of the call. Stamping untimed lines there would
  // invent a pace reading out of missing data.
  assert.equal(startSecondsFor('2026-09-10T07:52:00.000Z', null), undefined);
  assert.equal(startSecondsFor(null, '2026-09-10T07:54:00.000Z'), undefined);
  assert.equal(startSecondsFor('not a date', '2026-09-10T07:54:00.000Z'), undefined);
  assert.equal(startSecondsFor('2026-09-10T07:52:00.000Z', 'not a date'), undefined);
});

test('a NEGATIVE offset is corrupt, not "slightly before the start"', () => {
  assert.equal(startSecondsFor('2026-09-10T07:52:00.000Z', '2026-09-10T07:51:00.000Z'), undefined);
});

test('the rebuilt question carries one voice and every line, with its offsets', () => {
  const built = attributionFromTranscript({ started_at: '2026-09-10T07:52:00.000Z' }, [
    seg({ seq: 0, text: 'Morning, I am from Elostate.', spoken_at: '2026-09-10T07:52:03.000Z' }),
    seg({ seq: 1, text: 'How much is it?', spoken_at: '2026-09-10T07:52:30.000Z' }),
  ]);
  assert.ok(built);
  assert.deepEqual(built.speakers, [
    { speakerId: SOLO_SPEAKER_ID, sample: 'Morning, I am from Elostate.' },
  ]);
  assert.deepEqual(built.segments, [
    { speakerId: SOLO_SPEAKER_ID, text: 'Morning, I am from Elostate.', seq: 0, startSeconds: 3 },
    { speakerId: SOLO_SPEAKER_ID, text: 'How much is it?', seq: 1, startSeconds: 30 },
  ]);
});

test('a line with no timestamp carries NO offset key at all', () => {
  const built = attributionFromTranscript({ started_at: '2026-09-10T07:52:00.000Z' }, [
    seg({ seq: 0, text: 'Untimed line.', spoken_at: null }),
  ]);
  assert.ok(built);
  assert.equal('startSeconds' in built.segments[0]!, false);
});

test('the sample skips blank lines — the rep must have words to judge by', () => {
  const built = attributionFromTranscript({ started_at: '2026-09-10T07:52:00.000Z' }, [
    seg({ seq: 0, text: '   ' }),
    seg({ seq: 1, text: 'So what I do is knock a few doors on this street.' }),
  ]);
  assert.ok(built);
  assert.equal(
    built.speakers[0]!.sample,
    'So what I do is knock a few doors on this street.',
  );
});

test('nothing is asked about a transcript that already has an answer', () => {
  assert.equal(
    attributionFromTranscript({ started_at: '2026-09-10T07:52:00.000Z' }, [
      seg({ seq: 0, speaker: 'agent' }),
    ]),
    null,
  );
  assert.equal(attributionFromTranscript({ started_at: '2026-09-10T07:52:00.000Z' }, []), null);
});
