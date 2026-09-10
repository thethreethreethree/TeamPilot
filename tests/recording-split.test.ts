/**
 * When a long call is cut into parts.
 *
 * The arithmetic here decides the moment a rep's recording is closed without
 * them pressing anything. Get the margin wrong and the part lands over the
 * server's ceiling — which is the exact failure splitting exists to prevent, now
 * happening twice per call instead of once.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_RECORDING_SECONDS, MAX_UPLOAD_BYTES, BYTES_PER_SECOND } from '@/lib/audio/recording-budget';
import {
  SPLIT_AT_SECONDS,
  SPLIT_MARGIN_SECONDS,
  SPLIT_WARNING_SECONDS,
  partLabel,
  pitchCeilingText,
  shouldSplit,
  shouldWarnOfSplit,
  splitNoticeText,
  splitWarningText,
} from '@/lib/audio/recording-split';

test('a part is closed BELOW the ceiling, never at it', () => {
  // The check runs on a timer and a timer can be late. Splitting exactly at the
  // ceiling leaves no room for that, and a part a few seconds over is refused
  // for the same reason the whole call would have been.
  assert.ok(SPLIT_AT_SECONDS < MAX_RECORDING_SECONDS, 'the split is not below the ceiling');
  assert.equal(SPLIT_AT_SECONDS, MAX_RECORDING_SECONDS - SPLIT_MARGIN_SECONDS);
  assert.ok(SPLIT_MARGIN_SECONDS >= 60, 'the margin is too thin to absorb a late timer');
});

test('a part closed on time is a file the server will actually accept', () => {
  // The whole point, checked in bytes rather than in seconds.
  const bytes = SPLIT_AT_SECONDS * BYTES_PER_SECOND;
  assert.ok(bytes < MAX_UPLOAD_BYTES, `a full part is ${bytes} bytes against a ${MAX_UPLOAD_BYTES} ceiling`);
});

test('even a badly late split still lands under the ceiling', () => {
  // A whole minute late — a busy JS thread writing the previous part, a
  // backgrounded app. The margin has to absorb it.
  const late = (SPLIT_AT_SECONDS + 60) * BYTES_PER_SECOND;
  assert.ok(late < MAX_UPLOAD_BYTES, 'a minute of lateness pushes a part over the ceiling');
});

test('the split fires once the part is long enough, and not before', () => {
  assert.equal(shouldSplit(SPLIT_AT_SECONDS - 1), false);
  assert.equal(shouldSplit(SPLIT_AT_SECONDS), true);
  assert.equal(shouldSplit(SPLIT_AT_SECONDS + 600), true);
  assert.equal(shouldSplit(0), false);
  // A recorder that has not reported a duration yet must not trigger anything.
  assert.equal(shouldSplit(Number.NaN), false);
});

test('the rep is warned BEFORE a recording ends without them pressing Stop', () => {
  // This app has never ended a recording on its own. Doing it with no warning is
  // indistinguishable from it breaking.
  assert.equal(shouldWarnOfSplit(SPLIT_AT_SECONDS - SPLIT_WARNING_SECONDS), true);
  assert.equal(shouldWarnOfSplit(SPLIT_AT_SECONDS - SPLIT_WARNING_SECONDS - 1), false);
  // The warning stops once the split itself has happened - it has its own words.
  assert.equal(shouldWarnOfSplit(SPLIT_AT_SECONDS), false);
});

test('every part carries a name, because an unnamed one never sends', () => {
  // Automatic sending only touches a recording that has a name. A part the rep
  // never asked to create must not sit waiting to be named by somebody who does
  // not know it exists.
  assert.equal(partLabel(1), 'Long call, part 1');
  assert.equal(partLabel(2), 'Long call, part 2');
  assert.equal(partLabel(0), 'Long call, part 1');
  assert.equal(partLabel(2.7), 'Long call, part 2');
});

test('the copy tells the rep what happened and what to do next', () => {
  const notice = splitNoticeText(1);
  assert.match(notice, /part 1/i);
  assert.match(notice, /part 2/i);
  assert.match(notice, /Stop/);
  // Never presented as a fault: nothing went wrong.
  for (const text of [notice, splitWarningText(), pitchCeilingText()]) {
    assert.ok(!/error|failed|problem|sorry/i.test(text), text);
  }
  // The join IS a real loss and is named rather than glossed over.
  assert.match(notice, /join/i);
});

test('a door pitch is stopped, not split', () => {
  // A doorstep pitch past an hour and a half is not a pitch, and a second part
  // would be recording something the outcome prompt has no question for.
  const text = pitchCeilingText();
  assert.match(text, /stopped and saved/i);
  assert.match(text, /how it went/i);
  assert.ok(!/part/i.test(text), 'a pitch must not be described as being split');
});
