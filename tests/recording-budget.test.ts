/**
 * The sums that decide whether a rep loses a call.
 *
 * Both failures these guard against land AFTER the conversation: the server
 * refusing the file, or the phone running out of room mid-recording. Neither is
 * re-takeable, and until the split in `recording-budget.ts` neither sum could be
 * checked without a device.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  BYTES_PER_SECOND,
  DISK_HEADROOM_BYTES,
  MAX_RECORDING_SECONDS,
  MAX_UPLOAD_BYTES,
  diskBudget,
  remainingSecondsForSize,
  sendability,
  sizeForUpload,
} from '@/lib/audio/recording-budget';

test('the chosen format keeps a long appointment under the server ceiling', () => {
  // The claim in recording-format.ts's header, as arithmetic. HIGH_QUALITY
  // (128 kbps stereo) hits the ceiling at ~26 minutes; raising the bit rate back
  // to it would fail here rather than on a rep's phone after a long call.
  assert.ok(
    MAX_RECORDING_SECONDS / 60 >= 90,
    `expected at least 90 minutes of headroom, got ${Math.floor(MAX_RECORDING_SECONDS / 60)}`,
  );
});

test('a recording already at the ceiling has no time left, never negative', () => {
  assert.equal(remainingSecondsForSize(MAX_UPLOAD_BYTES), 0);
  // Over the ceiling. A negative countdown on screen reads as time GAINED.
  assert.equal(remainingSecondsForSize(MAX_UPLOAD_BYTES * 2), 0);
});

test('an empty recording has the full budget', () => {
  assert.equal(remainingSecondsForSize(0), MAX_RECORDING_SECONDS);
});

test('the remaining time falls by one second for every second recorded', () => {
  const before = remainingSecondsForSize(0);
  const after = remainingSecondsForSize(BYTES_PER_SECOND * 60);
  assert.equal(before - after, 60);
});

test('an unreadable size does not silently become a full budget', () => {
  // NaN arriving from a bad native read must not divide into a huge number.
  assert.equal(remainingSecondsForSize(Number.NaN), 0);
});

test('an unreadable disk figure still lets the rep record', () => {
  // Not knowing is not a reason to refuse. Flipping this to ok:false would
  // disable recording on every platform that does not report disk space.
  for (const bad of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
    const b = diskBudget(bad as number | null);
    assert.equal(b.ok, true, `unreadable figure ${String(bad)} blocked recording`);
    assert.equal(b.availableBytes, null);
    // Null, not 0 — "unknown" and "no room" are different facts.
    assert.equal(b.minutesAvailable, null);
  }
});

test('a full-length recording plus headroom is required before recording is ok', () => {
  const need = MAX_UPLOAD_BYTES + DISK_HEADROOM_BYTES;
  assert.equal(diskBudget(need).ok, true);
  assert.equal(diskBudget(need - 1).ok, false);
});

test('a disk inside the headroom reports no minutes rather than negative ones', () => {
  const b = diskBudget(DISK_HEADROOM_BYTES / 2);
  assert.equal(b.ok, false);
  assert.equal(b.minutesAvailable, 0);
  // Still reports the figure it read — the screen tells the rep how full it is.
  assert.equal(b.availableBytes, DISK_HEADROOM_BYTES / 2);
});

test('minutes available are counted after the headroom is set aside', () => {
  const b = diskBudget(DISK_HEADROOM_BYTES + BYTES_PER_SECOND * 60 * 10);
  assert.equal(b.minutesAvailable, 10);
});

test('an oversize recording is flagged before the rep taps Send', () => {
  const s = sendability(MAX_UPLOAD_BYTES + 5 * 1024 * 1024);
  assert.equal(s.sendable, false);
  assert.equal((s as { reason: string }).reason, 'too-large');
  assert.equal((s as { overMb: number }).overMb, 5);
});

test('a recording exactly at the ceiling is sendable', () => {
  // The server refuses ABOVE the limit, not AT it — warning here would strand a
  // recording the server would have accepted.
  assert.equal(sendability(MAX_UPLOAD_BYTES).sendable, true);
});

test('barely over still reports at least 1 MB over, never 0', () => {
  // "0 MB over" reads as a rounding quibble rather than a real limit.
  assert.equal((sendability(MAX_UPLOAD_BYTES + 1) as { overMb: number }).overMb, 1);
});

test('an unread size is never called unsendable', () => {
  // Same posture as the disk check: not knowing is not a verdict. Marking a
  // recording lost on a figure we failed to read is the more expensive mistake.
  for (const bad of [null, undefined, Number.NaN, 0, -1]) {
    const s = sendability(bad as number | null);
    assert.equal(s.sendable, true, `size ${String(bad)} was called unsendable`);
  }
});

test('an ordinary recording is simply sendable, with no caveat', () => {
  const s = sendability(2 * 1024 * 1024);
  assert.equal(s.sendable, true);
  assert.equal((s as { unknownSize?: boolean }).unknownSize, undefined);
});

test('a fractional byte count is made whole before it is sent', () => {
  // The sign route's schema is z.number().int() — a float is rejected outright,
  // and that request is the one thing between a rep and a saved recording.
  assert.equal(sizeForUpload(1234.7), 1234);
  assert.equal(sizeForUpload(1234), 1234);
});

test('it rounds DOWN, so the claimed size never exceeds the file', () => {
  assert.equal(sizeForUpload(999.99), 999);
});

test('an unreadable size becomes 0 rather than a rejected request', () => {
  // 0 is accepted by the schema (nonnegative) and the upload path already
  // treats a zero-byte recording as its own, clearer failure.
  for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
    assert.equal(sizeForUpload(bad as number | null), 0, `size ${String(bad)}`);
  }
});
