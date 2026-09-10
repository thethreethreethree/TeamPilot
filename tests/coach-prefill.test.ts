/**
 * Regression tests for the transcript the coach is given.
 *
 * The failure this guards is a confident answer to the wrong question. If a long
 * call is trimmed silently, the coach reads the last twenty minutes and the rep
 * believes the reply covers the whole conversation — and nothing in the answer
 * would reveal it. The bound is fine; the bound WITHOUT the label is the defect.
 *
 * The second thing guarded is which end survives. A question about a call is
 * almost always about how it finished, so keeping the opening and dropping the
 * close would remove the part being asked about.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  transcriptForCoach,
  conversationForRequest,
  PREFILL_MAX_CHARS,
  type PrefillSegment,
} from '@/lib/coach-prefill';

const line = (speaker: string, text: string): PrefillSegment => ({ speaker, text });

/** n lines of roughly `chars` each, numbered so order is checkable. */
const many = (n: number, chars = 100): PrefillSegment[] =>
  Array.from({ length: n }, (_, i) =>
    line(i % 2 ? 'agent' : 'customer', `${i} ${'x'.repeat(Math.max(0, chars - 4))}`),
  );

test('a short call is passed through whole, with no notice', () => {
  const text = transcriptForCoach([
    line('customer', 'Your price is too high.'),
    line('agent', 'What are you comparing it to?'),
  ]);
  assert.equal(text, 'Customer: Your price is too high.\nMe: What are you comparing it to?');
  assert.ok(!text.includes('not included'), 'nothing was cut, so nothing is claimed to be');
});

test('speakers are named the way a person reads them', () => {
  const text = transcriptForCoach([
    line('agent', 'a'),
    line('customer', 'b'),
    line('unknown', 'c'),
  ]);
  assert.equal(text, 'Me: a\nCustomer: b\nUnclear: c');
});

test('an empty transcript produces nothing, not a notice about nothing', () => {
  assert.equal(transcriptForCoach([]), '');
});

/* ── the bound ─────────────────────────────────────────────────────────── */

test('a long call is trimmed to the budget', () => {
  const text = transcriptForCoach(many(1000), 2_000);
  assert.ok(text.length < 4_000, `expected a trimmed result, got ${text.length} chars`);
});

test('the trim keeps the END of the call, which is what gets asked about', () => {
  const text = transcriptForCoach(many(200), 1_000);
  assert.ok(text.includes(': 199 '), 'the last line survived');
  assert.ok(!text.includes(': 0 '), 'the first line did not');
});

test('a trim is always announced, with how much is missing', () => {
  // The whole point. A bound is fine; a silent bound is the defect.
  const text = transcriptForCoach(many(200), 1_000);
  assert.match(text, /^\[The first \d+ lines of this call are not included here/);
  assert.ok(text.includes('Paste any earlier part'), 'and it says what to do about it');
});

test('the announced count is the number actually dropped', () => {
  // A wrong number here is worse than none: a rep would trust it.
  const text = transcriptForCoach(many(200), 1_000);
  const dropped = Number(/^\[The first (\d+) lines/.exec(text)?.[1]);
  const keptLines = text.split('\n').filter((l) => /^(Me|Customer|Unclear): /.test(l)).length;
  assert.equal(dropped + keptLines, 200, 'dropped plus kept accounts for every line');
});

test('one line dropped is described in the singular', () => {
  // Small, but "1 lines" is the kind of thing that makes a rep trust the rest of
  // the screen slightly less.
  const lines = many(2, 600);
  const text = transcriptForCoach(lines, 700);
  assert.ok(text.includes('The first 1 line of this call'), text.slice(0, 80));
});

test('a single turn longer than the whole budget still reaches the coach', () => {
  // Better a long answer than an empty box, which reads as the transcript
  // having failed to load.
  const text = transcriptForCoach([line('customer', 'y'.repeat(5_000))], 1_000);
  assert.ok(text.includes('y'.repeat(100)), 'the line survived');
});

test('the trim counts characters, not lines', () => {
  // One rambling answer can outweigh fifty short exchanges. A line count would
  // keep wildly different amounts of conversation depending on how people spoke.
  const chatty = transcriptForCoach(many(100, 20), 1_000);
  const rambling = transcriptForCoach(many(100, 400), 1_000);
  const count = (t: string) => t.split('\n').filter((l) => /^(Me|Customer): /.test(l)).length;
  assert.ok(
    count(chatty) > count(rambling),
    `short lines should fit more of them: ${count(chatty)} vs ${count(rambling)}`,
  );
});

test('the default budget is used when none is given', () => {
  const text = transcriptForCoach(many(2_000, 100));
  assert.ok(text.length <= PREFILL_MAX_CHARS + 500, `got ${text.length} chars`);
  assert.ok(text.includes('not included here'), 'and it said so');
});

test('a call exactly at the budget is not trimmed', () => {
  // Off-by-one here would put a "lines are missing" notice on a complete
  // transcript, which is a lie in the opposite direction.
  const one = many(1, 50);
  const text = transcriptForCoach(one, 10_000);
  assert.ok(!text.includes('not included'), text.slice(0, 60));
});

/* ── bounding what is SENT, not what the rep sees ──────────────────────── */

test('a short conversation is sent unchanged', () => {
  const text = 'Customer: too expensive.\nMe: compared to what?';
  const out = conversationForRequest(text);
  assert.equal(out.text, text);
  assert.equal(out.droppedLines, 0);
});

test('a long conversation sends the end, and reports how much it left out', () => {
  const lines = Array.from({ length: 400 }, (_, i) => `Customer: ${i} ${'x'.repeat(100)}`);
  const out = conversationForRequest(lines.join('\n'), 2_000);

  assert.ok(out.text.length <= 2_100, `sent ${out.text.length} chars`);
  assert.ok(out.droppedLines > 0, 'and it said so');
  assert.ok(out.text.includes(': 399 '), 'the most recent exchange survived');
  assert.ok(!out.text.includes(': 0 '), 'the oldest did not');
});

test('the reported number of dropped lines is exact', () => {
  const lines = Array.from({ length: 400 }, (_, i) => `Customer: ${i} ${'x'.repeat(100)}`);
  const out = conversationForRequest(lines.join('\n'), 2_000);
  const sentLines = out.text.split('\n').length;
  assert.equal(out.droppedLines + sentLines, 400);
});

test('it cuts on a line boundary, never mid-sentence', () => {
  // A coach handed half a sentence with no marker will answer as though that is
  // what the customer said.
  const lines = Array.from({ length: 100 }, (_, i) => `Customer: sentence number ${i} ends here.`);
  const out = conversationForRequest(lines.join('\n'), 500);
  for (const line of out.text.split('\n')) {
    assert.match(line, /^Customer: sentence number \d+ ends here\.$/, line);
  }
});

test('a single enormous line is still sent rather than nothing', () => {
  // An empty request would look like the app lost what the rep typed.
  const out = conversationForRequest('Customer: ' + 'y'.repeat(50_000), 1_000);
  assert.ok(out.text.length > 1_000, 'the line survived whole');
  assert.equal(out.droppedLines, 0);
});

test('an empty conversation stays empty', () => {
  assert.deepEqual(conversationForRequest(''), { text: '', droppedLines: 0 });
});

test('the default budget matches the prefill budget', () => {
  // The two run back to back — a transcript is prefilled and then sent. Budgets
  // that disagreed would trim twice and report only one of the cuts.
  const text = 'x'.repeat(PREFILL_MAX_CHARS - 1);
  assert.equal(conversationForRequest(text).droppedLines, 0);
});

/* ── an unattributed transcript ────────────────────────────────────────── */

test('an unattributed transcript tells the coach it is unattributed', () => {
  // Before a rep answers "which voice is you?", every line is `unknown`. Handed
  // that without comment the coach answers as though it knows who said what —
  // and its advice on handling an objection may be advice about a sentence the
  // REP said. Nothing in the reply would reveal it.
  const text = transcriptForCoach([
    line('unknown', 'Your price is too high.'),
    line('unknown', 'Compared to what?'),
  ]);
  assert.match(text, /^\[Nobody has said which voice is the salesperson/);
  assert.ok(text.includes('Do not assume who said what'));
});

test('an attributed transcript carries no such warning', () => {
  const text = transcriptForCoach([
    line('customer', 'Your price is too high.'),
    line('agent', 'Compared to what?'),
  ]);
  assert.ok(!text.includes('Nobody has said which voice'), text.slice(0, 80));
});

test('one attributed line is enough to count as attributed', () => {
  // A diarization that could not place one line still knows the sides. Warning
  // here would train reps to ignore the warning.
  const text = transcriptForCoach([
    line('agent', 'Morning.'),
    line('unknown', '(inaudible)'),
  ]);
  assert.ok(!text.includes('Nobody has said which voice'));
});

test('a long UNATTRIBUTED call reports BOTH the trim and the warning', () => {
  // Two separate early returns would emit only the first. The trim is the less
  // important of the two, so losing the warning is the failure that matters.
  const unknowns = Array.from({ length: 200 }, (_, i) =>
    line('unknown', `${i} ${'x'.repeat(96)}`),
  );
  const text = transcriptForCoach(unknowns, 1_000);
  assert.ok(text.includes('are not included here'), 'the trim was reported');
  assert.ok(text.includes('Nobody has said which voice'), 'and so was the attribution');
});

test('the warning does not consume the transcript budget silently', () => {
  // The notice is prepended after trimming, so the spoken lines kept are the
  // same either way — a rep comparing two calls should not find one shorter
  // because of a warning.
  const attributed = transcriptForCoach(
    Array.from({ length: 200 }, (_, i) => line(i % 2 ? 'agent' : 'customer', `${i} ${'x'.repeat(96)}`)),
    1_000,
  );
  const unattributed = transcriptForCoach(
    Array.from({ length: 200 }, (_, i) => line('unknown', `${i} ${'x'.repeat(96)}`)),
    1_000,
  );
  const spoken = (t: string) => t.split('\n').filter((l) => /^(Me|Customer|Unclear): /.test(l)).length;
  assert.equal(spoken(attributed), spoken(unattributed));
});
