import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasSpeech } from '../src/lib/audio/speech-presence';

/**
 * hasSpeech — the app's copy of the web repository's `transcriptHasSpeech`.
 *
 * Every string marked "measured" below is a VERBATIM production transcript read from
 * `pitch_transcripts` on 2026-09-10, not an invented example. The two repositories pin the same
 * strings on purpose: they cannot import from each other, so a change to one that the other does
 * not follow shows up here as a failure instead of as silent drift.
 */
const MEASURED_NON_SPEECH = [
  '[clicking]', // measured — 8 rows
  '[pause]', // measured — 6 rows
  '[outro jingle]', // measured — 5 rows
  '[background noise]', // measured — 2 rows
  '[typing]', // measured — the one scored tone 85
  '[silence]',
  '[phone ringing]',
  '[wind blowing]',
  '[singing]',
  '[zipper closing]',
  '[click]',
];

for (const t of MEASURED_NON_SPEECH) {
  test(`hasSpeech is false for ${t}`, () => {
    assert.equal(hasSpeech(t), false);
  });
}

test('empty, whitespace, null and undefined carry no speech', () => {
  assert.equal(hasSpeech(''), false);
  assert.equal(hasSpeech('   '), false);
  assert.equal(hasSpeech(null), false);
  assert.equal(hasSpeech(undefined), false);
});

test('punctuation alone carries no speech', () => {
  assert.equal(hasSpeech('... -- ?!'), false);
});

test('the other annotation forms are handled too', () => {
  assert.equal(hasSpeech('(laughs)'), false);
  assert.equal(hasSpeech('*sighs*'), false);
  assert.equal(hasSpeech('[clicking] [pause] [clicking]'), false);
});

test('an annotation MIXED with speech is a real line', () => {
  assert.equal(hasSpeech("[background noise] Hi, I'm John from Elostate."), true);
});

test('the shortest measured real transcripts pass', () => {
  assert.equal(hasSpeech('He\u2019s not getting carried'), true);
  assert.equal(hasSpeech('He gave it like Samuel L. Jackson attitude'), true);
});

test('a single word, a number, and non-Latin script all count as speech', () => {
  assert.equal(hasSpeech('Hello'), true);
  assert.equal(hasSpeech('2000'), true);
  assert.equal(hasSpeech('hola, \u00bfc\u00f3mo est\u00e1?'), true);
  assert.equal(hasSpeech('\u4f60\u597d'), true);
});
