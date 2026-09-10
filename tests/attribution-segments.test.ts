/**
 * The segments echoed back when a rep says which voice is theirs.
 *
 * THE FIELD THAT MATTERS IS `startSeconds`, and it is invisible. The server
 * stamps `spoken_at` from it, and the Coach Assessment's "speed" skill needs
 * three timed agent turns before it scores anything. Drop it and nothing fails:
 * the label succeeds, the transcript is right, and the pace skill quietly reads
 * "not enough sessions yet" forever — which is exactly what it did for every
 * uploaded recording until 10 September 2026.
 *
 * So it is kept on purpose, and this is where that is held still.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { attributionSegments } from '@/lib/audio/upload-flow';

const seg = (seq: number, extra: Record<string, unknown> = {}) => ({
  speakerId: 'speaker_0',
  text: 'Hi, I am from Acme.',
  seq,
  ...extra,
});

test('the audio offset survives, because the pace skill is built on it', () => {
  const out = attributionSegments([seg(0, { startSeconds: 0 }), seg(1, { startSeconds: 4.5 })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].startSeconds, 0);
  assert.equal(out[1].startSeconds, 4.5);
});

test('an unknown offset is OMITTED, never zeroed', () => {
  // A 0 claims the turn opened the call. The server reads an absent offset as
  // "we do not know" and leaves spoken_at null, which is the truth.
  const out = attributionSegments([seg(0), seg(1, { startSeconds: null })]);
  assert.equal('startSeconds' in out[0], false);
  assert.equal('startSeconds' in out[1], false);
});

test('a nonsense offset is dropped rather than sent', () => {
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, '4.5']) {
    const out = attributionSegments([seg(0, { startSeconds: bad })]);
    assert.equal('startSeconds' in out[0], false, `kept ${String(bad)}`);
    // The segment itself still goes — a bad timestamp must not cost a line.
    assert.equal(out[0].text, 'Hi, I am from Acme.');
  }
});

test('one malformed entry refuses the WHOLE payload, never a partial relabel', () => {
  // The labelling route rebuilds the transcript from exactly this list, so a
  // list with a hole relabels part of a call and silently loses the rest.
  assert.deepEqual(attributionSegments([seg(0), { speakerId: 'speaker_1', seq: 1 }]), []);
  assert.deepEqual(attributionSegments([seg(0), seg(1.5)]), []);
  assert.deepEqual(attributionSegments([seg(0), seg(-1)]), []);
  assert.deepEqual(attributionSegments([seg(0), { ...seg(1), text: '' }]), []);
});

test('nothing in, nothing out — and no throw on rubbish', () => {
  assert.deepEqual(attributionSegments(undefined), []);
  assert.deepEqual(attributionSegments(null), []);
  assert.deepEqual(attributionSegments([]), []);
  assert.deepEqual(attributionSegments('segments'), []);
});
