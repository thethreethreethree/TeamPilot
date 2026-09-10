import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SOLO_SPEAKER_ID, isAnswerable, speakersFromTranscript } from '../src/lib/audio/relabel-unknown';
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
  assert.equal(isAnswerable([seg({ seq: 0 }), seg({ seq: 1 })]), true);
});

test('an EMPTY transcript is not asked about — there is nothing to attribute yet', () => {
  // The screen has its own "still transcribing" state for this. Offering a voice question
  // with no voices in it would ask the rep about nothing.
  assert.equal(isAnswerable([]), false);
});

test('a transcript with even ONE attributed turn is never re-asked', () => {
  // The server refuses to change an attributed transcript, so asking would invite a tap
  // that 409s — and a question the system will not honour teaches the rep to ignore it.
  assert.equal(isAnswerable([seg({ seq: 0, speaker: 'agent' }), seg({ seq: 1 })]), false);
  assert.equal(isAnswerable([seg({ seq: 0, speaker: 'customer' }), seg({ seq: 1 })]), false);
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

/**
 * A recovered call that captured no speech (2026-09-10).
 *
 * STT never returns "" for a silent recording — it returns the sound it heard, annotated. Measured
 * against production: 28 of 73 stored door-pitch transcripts are exactly one bracketed sound event.
 * The sample line is what a rep READS to decide whose voice it is, so a sound is not an answerable
 * question — and storing whatever they guess is worse than not asking.
 */
test('the sample skips a sound-event line and shows the first line with real words', () => {
  const speakers = speakersFromTranscript([
    seg({ seq: 0, text: '[clicking]' }),
    seg({ seq: 1, text: '[pause]' }),
    seg({ seq: 2, text: 'Hi there, do you own the home?' }),
  ]);
  assert.deepEqual(speakers, [
    { speakerId: SOLO_SPEAKER_ID, sample: 'Hi there, do you own the home?' },
  ]);
});

test('a transcript of nothing but sound events still asks, with an EMPTY sample — never a zipper', () => {
  // Same decision as the blank-lines case: the question stands because the transcript is real and
  // unattributed. What must never happen is `[zipper closing]` being shown to a rep as a line they
  // said. An empty sample is honest; a sound presented as speech is not.
  const speakers = speakersFromTranscript([
    seg({ seq: 0, text: '[clicking]' }),
    seg({ seq: 1, text: '[outro jingle]' }),
    seg({ seq: 2, text: '[zipper closing]' }),
  ]);
  assert.deepEqual(speakers, [{ speakerId: SOLO_SPEAKER_ID, sample: '' }]);
});

test('a line that MIXES noise with speech is a real line, and is offered as the sample', () => {
  const speakers = speakersFromTranscript([seg({ seq: 0, text: "[background noise] I'm John." })]);
  assert.deepEqual(speakers, [{ speakerId: SOLO_SPEAKER_ID, sample: "[background noise] I'm John." }]);
});

/**
 * A REP MAY CORRECT A MACHINE; A REP MAY NEVER OVERWRITE A PERSON (2026-09-10, mirrors server 2fb2b5ae).
 *
 * The gate used to mean "every segment is unknown". Both this and the server's precondition were testing
 * the LABEL when the rule is really about the AUTHOR. Measured on production: of 2,414 stored segments not
 * one carries source 'manual', and six sessions are labelled entirely 'customer' — one of them 160 words
 * of a rep's own doorstep pitch, which they could read, watch score nothing, and never fix.
 */
test('a machine-labelled CUSTOMER transcript is answerable — this is what was unfixable', () => {
  const speakers = speakersFromTranscript([
    seg({ seq: 0, speaker: 'customer', source: 'loudness', text: 'Okay. Well, the whole reason I got sent out here' }),
    seg({ seq: 1, speaker: 'customer', source: 'loudness', text: "is we've just finished two roofs on this street." }),
  ]);
  assert.deepEqual(speakers, [
    { speakerId: SOLO_SPEAKER_ID, sample: 'Okay. Well, the whole reason I got sent out here' },
  ]);
});

test('ONE manual segment closes the question — a person already answered', () => {
  const speakers = speakersFromTranscript([
    seg({ seq: 0, speaker: 'customer', source: 'loudness' }),
    seg({ seq: 1, speaker: 'customer', source: 'manual' }),
  ]);
  assert.equal(speakers, null);
});

test('a two-voice transcript is never asked about — that call already says who spoke', () => {
  const speakers = speakersFromTranscript([
    seg({ seq: 0, speaker: 'agent', source: 'loudness' }),
    seg({ seq: 1, speaker: 'customer', source: 'loudness' }),
  ]);
  assert.equal(speakers, null);
});

test('an AGENT-labelled transcript is NOT asked about — it already coaches, so the question is noise', () => {
  // A UI judgement rather than a server rule: the server would accept the correction, but offering it
  // here would put a question on 43 of the 176 sessions that are working fine. The question belongs
  // exactly where the rep is currently getting nothing.
  const speakers = speakersFromTranscript([
    seg({ seq: 0, speaker: 'agent', source: 'loudness' }),
    seg({ seq: 1, speaker: 'agent', source: 'loudness' }),
  ]);
  assert.equal(speakers, null);
});

test('a mix of unknown and a machine label is not one voice, so it is not asked about', () => {
  const speakers = speakersFromTranscript([
    seg({ seq: 0, speaker: 'unknown' }),
    seg({ seq: 1, speaker: 'customer', source: 'loudness' }),
  ]);
  assert.equal(speakers, null);
});

test('an absent source is not a human answer — a missing field never means somebody spoke', () => {
  const speakers = speakersFromTranscript([seg({ seq: 0, speaker: 'customer', source: null, text: 'Morning.' })]);
  assert.deepEqual(speakers, [{ speakerId: SOLO_SPEAKER_ID, sample: 'Morning.' }]);
});
