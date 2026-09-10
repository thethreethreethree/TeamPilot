/**
 * Regression tests for interleaving coach cues into the transcript.
 *
 * The risk this guards is not a crash — it is a plausible-looking lie. If a cue
 * is placed at the wrong moment, the screen tells the rep the coach warned them
 * about price BEFORE the customer raised it, and nothing about the output looks
 * wrong. Both timestamp columns are nullable, so the cases that matter most are
 * the ones where the clock is partly or entirely missing.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTimeline } from '@/lib/session-timeline';
import type { CoachingCue, TranscriptSegment } from '@/types/backend';

const seg = (seq: number, text: string, spoken_at: string | null): TranscriptSegment =>
  ({ id: `s${seq}`, seq, speaker: 'customer', text, spoken_at }) as TranscriptSegment;

const cue = (id: string, text: string, delivered_at: string | null): CoachingCue =>
  ({ id, text, mode: 'suggestion', delivered_at }) as CoachingCue;

/** Compact shape of the result, so a failure reads as an order not an object. */
const shape = (r: ReturnType<typeof buildTimeline>) =>
  r.entries.map((e) => (e.kind === 'segment' ? e.segment.id : e.cue.id)).join(' ');

test('a cue lands between the lines it was delivered between', () => {
  const r = buildTimeline(
    [
      seg(1, 'How much?', '2026-09-01T10:00:00Z'),
      seg(2, 'It pays back in a quarter.', '2026-09-01T10:00:20Z'),
    ],
    [cue('c1', 'Lead with payback, not price.', '2026-09-01T10:00:10Z')],
  );
  assert.equal(shape(r), 's1 c1 s2');
  assert.deepEqual(r.unplacedCues, []);
});

test('a cue delivered after the last line still appears, at the end', () => {
  const r = buildTimeline(
    [seg(1, 'I need to think.', '2026-09-01T10:00:00Z')],
    [cue('c1', 'Book the follow-up now.', '2026-09-01T10:05:00Z')],
  );
  assert.equal(shape(r), 's1 c1');
});

test('a cue delivered before the first line comes first', () => {
  const r = buildTimeline(
    [seg(1, 'Hi.', '2026-09-01T10:00:00Z')],
    [cue('c1', 'Open with the referral.', '2026-09-01T09:59:00Z')],
  );
  assert.equal(shape(r), 'c1 s1');
});

test('segments follow seq, not their timestamps', () => {
  // A server clock can be out of order; seq is authoritative and must win.
  const r = buildTimeline(
    [seg(2, 'second', '2026-09-01T10:00:00Z'), seg(1, 'first', '2026-09-01T10:00:30Z')],
    [],
  );
  assert.equal(shape(r), 's1 s2');
});

test('cues are ordered among themselves by delivery time', () => {
  const r = buildTimeline(
    [seg(1, 'a', '2026-09-01T10:00:00Z'), seg(2, 'b', '2026-09-01T10:01:00Z')],
    [
      cue('late', 'second', '2026-09-01T10:00:40Z'),
      cue('early', 'first', '2026-09-01T10:00:10Z'),
    ],
  );
  assert.equal(shape(r), 's1 early late s2');
});

test('an untimed cue is reported as unplaced, never guessed into position', () => {
  const r = buildTimeline([seg(1, 'a', '2026-09-01T10:00:00Z')], [cue('c1', 'x', null)]);
  assert.equal(shape(r), 's1');
  assert.deepEqual(r.unplacedCues.map((c) => c.id), ['c1']);
});

test('an unparseable timestamp is treated as absent, not as 1970', () => {
  // new Date('not a date').getTime() is NaN; sorting on NaN would scatter the
  // cue anywhere in the list, which is exactly the silent lie to avoid.
  const r = buildTimeline([seg(1, 'a', '2026-09-01T10:00:00Z')], [cue('c1', 'x', 'not a date')]);
  assert.equal(shape(r), 's1');
  assert.deepEqual(r.unplacedCues.map((c) => c.id), ['c1']);
});

test('with no segment clock at all, cues follow the whole conversation', () => {
  const r = buildTimeline(
    [seg(1, 'a', null), seg(2, 'b', null)],
    [cue('c1', 'x', '2026-09-01T10:00:00Z')],
  );
  assert.equal(shape(r), 's1 s2 c1');
  assert.deepEqual(r.unplacedCues, []);
});

test('a segment with no clock does not swallow a pending cue', () => {
  // s2 has no time, so it cannot decide whether the cue precedes it; the cue
  // must wait for s3, which can.
  const r = buildTimeline(
    [
      seg(1, 'a', '2026-09-01T10:00:00Z'),
      seg(2, 'b', null),
      seg(3, 'c', '2026-09-01T10:02:00Z'),
    ],
    [cue('c1', 'x', '2026-09-01T10:01:00Z')],
  );
  assert.equal(shape(r), 's1 s2 c1 s3');
});

test('no cues at all leaves the transcript untouched', () => {
  const r = buildTimeline([seg(1, 'a', '2026-09-01T10:00:00Z')], []);
  assert.equal(shape(r), 's1');
});

test('cues with no transcript are all returned, in time order', () => {
  const r = buildTimeline([], [
    cue('b', 'second', '2026-09-01T10:01:00Z'),
    cue('a', 'first', '2026-09-01T10:00:00Z'),
  ]);
  assert.equal(shape(r), 'a b');
});

test('an empty session produces an empty timeline rather than throwing', () => {
  const r = buildTimeline([], []);
  assert.equal(shape(r), '');
  assert.deepEqual(r.unplacedCues, []);
});

test('the input arrays are not mutated', () => {
  // The screen keeps its own copies for the export; reordering in place would
  // change what gets shared as a side effect of rendering.
  const segments = [seg(2, 'b', '2026-09-01T10:01:00Z'), seg(1, 'a', '2026-09-01T10:00:00Z')];
  buildTimeline(segments, []);
  assert.deepEqual(segments.map((s) => s.seq), [2, 1]);
});
