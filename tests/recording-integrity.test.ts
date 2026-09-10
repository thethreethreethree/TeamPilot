import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkRecordingIntegrity,
  integrityMessage,
  MIN_RECORDING_BYTES,
  MIN_BYTES_PER_SECOND,
} from '../src/lib/audio/recording-integrity';

/**
 * recording-integrity — the check that would have caught a 5-byte "two minute" recording
 * at the door instead of five server retries later, in a row nobody reads.
 *
 * Measured on production 10 September 2026: 14 of 83 door pitches failed permanently, and
 * one of them was 5 bytes of Matroska container with `duration_ms = 129800` against it.
 */

test('THE PRODUCTION FAILURE: 5 bytes claiming 129.8 seconds is refused', () => {
  // The exact row: audio size=5, ct=audio/webm, head=1c53bb6b80 (a Matroska Cues id — a
  // container fragment with no media in it), duration_ms 129800.
  const r = checkRecordingIntegrity(5, 129_800);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, 'empty');
});

test('a real recording passes — measured, not imagined', () => {
  // Three real files from this company's own storage, with their true durations.
  assert.equal(checkRecordingIntegrity(42_975_676, 2_560_000).ok, true); // 42-minute call
  assert.equal(checkRecordingIntegrity(619_620, 149_000).ok, true); // the 149s test
  assert.equal(checkRecordingIntegrity(62_019, 7_000).ok, true); // a 7s clip
});

test('bytes without media are refused however long the timer claims', () => {
  assert.equal(checkRecordingIntegrity(0, 60_000).ok, false);
  assert.equal(checkRecordingIntegrity(MIN_RECORDING_BYTES - 1, 60_000).ok, false);
  // And exactly at the floor it is allowed through — the floor is "below this is
  // impossible", not "below this is suspicious".
  assert.equal(checkRecordingIntegrity(MIN_RECORDING_BYTES, 1_000).ok, true);
});

test('a file far too small for its own length is refused, and says which', () => {
  // 2 KB claiming five minutes: about 7 bytes a second. Real voice is 4,100+.
  const r = checkRecordingIntegrity(2048, 300_000);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, 'too-small-for-its-length');
});

test('the rate floor sits far below any real recording, so a quiet room still sends', () => {
  // 200 B/s is twenty times under the lowest real value measured. A genuinely quiet
  // 60-second recording at even 1 KB/s passes comfortably.
  assert.equal(checkRecordingIntegrity(60_000, 60_000).ok, true);
  assert.ok(MIN_BYTES_PER_SECOND < 4_100);
});

test('the rate rule cannot bite below ~5.1 seconds, and does bite above it', () => {
  // This replaces a `duration > 3000ms` exemption that a mutation proved could NEVER fire.
  // The two floors already decide it: a file at the 1,024-byte minimum crosses under
  // 200 B/s only past 5,120 ms, so no short clip can ever be failed by rate.
  const boundaryMs = (MIN_RECORDING_BYTES / MIN_BYTES_PER_SECOND) * 1000;
  assert.equal(boundaryMs, 5_120);

  // Just inside it: 341 B/s, allowed.
  assert.equal(checkRecordingIntegrity(MIN_RECORDING_BYTES, 3_000).ok, true);
  // Well past it: 170 B/s, refused — which is the rule doing its job, not an exemption.
  assert.equal(checkRecordingIntegrity(MIN_RECORDING_BYTES, 6_000).ok, false);
});

test('AN UNKNOWN IS NEVER A FAILURE — no size reading means no verdict', () => {
  // Refusing to send on "do not know" would throw away a rep's real call to guard against
  // a maybe. Only a size the app HAS, and that is unambiguously too small, fails.
  assert.equal(checkRecordingIntegrity(null, 129_800).ok, true);
  assert.equal(checkRecordingIntegrity(undefined, 129_800).ok, true);
  assert.equal(checkRecordingIntegrity(Number.NaN, 129_800).ok, true);
  assert.equal(checkRecordingIntegrity(-1, 129_800).ok, true);
});

test('an unknown DURATION still lets the absolute floor apply', () => {
  // The rate test needs a duration; the "there is no media here" test does not.
  assert.equal(checkRecordingIntegrity(5, null).ok, false);
  assert.equal(checkRecordingIntegrity(500_000, null).ok, true);
});

test('the message blames the phone, not the rep, and names what survives', () => {
  for (const reason of ['empty', 'too-small-for-its-length'] as const) {
    const m = integrityMessage(reason);
    // The knock, the outcome and the day are all still saved — a rep who reads this as
    // "I lost the door" would stop trusting the app with the rest of it.
    assert.match(m, /Everything else about this door is saved/);
    assert.match(m, /record it again/);
    assert.doesNotMatch(m, /error|invalid|corrupt/i);
  }
});
