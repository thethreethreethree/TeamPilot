/**
 * The four phases of a sale, and the one way this can lie to a rep.
 *
 * The server OMITS a phase nobody has graded rather than sending it with a null
 * average. Rendering the payload as it arrives would make "Close" disappear from
 * a rep's process — which reads as "close is not part of this" to the one rep who
 * most needs to know their close has never been measured.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTHING_GRADED_BODY,
  PROCESS_PHASES,
  nothingGradedYet,
  processRows,
} from '@/lib/process-breakdown';

const FULL = [
  { key: 'intro', label: 'Intro', avg: 7.5, samples: 4, tip: 'Open with their name.' },
  { key: 'discovery', label: 'Discovery', avg: 6, samples: 4, tip: 'Ask one more question.' },
  { key: 'consultation', label: 'Consultation', avg: 8, samples: 3, tip: 'Tie it to their bill.' },
  { key: 'close', label: 'Close', avg: 4.2, samples: 2, tip: 'Ask for the sale plainly.' },
];

test('all four phases are always shown, in the order a sale happens', () => {
  assert.deepEqual(
    processRows(FULL).map((r) => r.key),
    [...PROCESS_PHASES],
  );
});

test('a phase the server OMITTED still appears, as unmeasured', () => {
  // The trap: aggregateProcessBreakdown does `if (entries.length === 0) continue`.
  // A phase nobody graded is absent from the array entirely.
  const rows = processRows(FULL.filter((p) => p.key !== 'close'));
  assert.equal(rows.length, 4, 'a phase vanished from the rep process');
  const close = rows.find((r) => r.key === 'close')!;
  assert.equal(close.avg, null);
  assert.equal(close.fraction, null, 'a bar was drawn for an unmeasured phase');
  assert.equal(close.label, 'Close', 'the phase lost its name');
});

test('an unmeasured phase never renders as a zero', () => {
  // A 0/10 says "graded, and terrible". Null says "nobody has looked". They send
  // a rep to two completely different conversations with their manager.
  const rows = processRows([{ key: 'intro', label: 'Intro', avg: null, samples: 0, tip: 'x' }]);
  const intro = rows.find((r) => r.key === 'intro')!;
  assert.equal(intro.avg, null);
  assert.notEqual(intro.avg, 0);
  assert.equal(intro.fraction, null);
  assert.equal(intro.tip, null, 'a tip was shown for a phase with no score behind it');
});

test('a real average produces a clamped bar fraction', () => {
  const rows = processRows(FULL);
  assert.equal(rows.find((r) => r.key === 'intro')!.fraction, 0.75);
  // A server that ever sent 11 must not draw past the end of the track.
  const over = processRows([{ key: 'intro', label: 'Intro', avg: 11, samples: 1, tip: 't' }]);
  assert.equal(over.find((r) => r.key === 'intro')!.fraction, 1);
});

test('an empty or malformed payload still yields four honest rows', () => {
  for (const payload of [[], null, undefined, 'nope', {}, [null, 42, { nope: true }]]) {
    const rows = processRows(payload);
    assert.equal(rows.length, 4, `bad payload ${JSON.stringify(payload)} lost the phases`);
    assert.ok(rows.every((r) => r.avg === null));
    assert.ok(nothingGradedYet(rows));
  }
});

test('nothingGradedYet is false the moment one phase has a score', () => {
  const rows = processRows([{ key: 'close', label: 'Close', avg: 3, samples: 1, tip: 't' }]);
  assert.equal(nothingGradedYet(rows), false);
});

test('the spoken form says the count, so a screen reader hears the weight too', () => {
  const rows = processRows(FULL);
  assert.match(rows[0].spoken, /Intro, 7\.5 out of 10, from 4 sessions/);
  assert.match(processRows([]).at(-1)!.spoken, /not enough sessions yet/);
  // Singular reads correctly, because "from 1 sessions" is the kind of detail a
  // rep notices and quietly stops trusting the screen over.
  const one = processRows([{ key: 'intro', label: 'Intro', avg: 5, samples: 1, tip: 't' }]);
  assert.match(one[0].spoken, /from 1 session\b/);
});

test('the empty-section copy names the cause, not the symptom', () => {
  assert.match(NOTHING_GRADED_BODY, /not been graded/);
  assert.match(NOTHING_GRADED_BODY, /fills in/);
  assert.ok(!/error|unavailable|failed/i.test(NOTHING_GRADED_BODY));
});
