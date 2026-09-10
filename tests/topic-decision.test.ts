/**
 * Regression tests for the decision shown on a chat topic.
 *
 * THE FAILURE THIS GUARDS is treating 'defer' as no decision.
 *
 * The column allows 'user' | 'system' | 'hybrid' | 'defer'. A deferred dialogue
 * is somebody having worked the question and concluded that NOT acting yet was
 * the answer. Rendering that as blank, or as "still in progress", tells a rep
 * the question is open — which is precisely how a settled decision gets
 * re-litigated at the next team meeting.
 *
 * The second is quieter: a decision row whose phase is unreadable. Discarding it
 * shows nothing, and nothing is the one answer that is certainly wrong — a row
 * exists, so something IS happening in this topic.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pathLabel,
  phaseLabel,
  phaseStep,
  readTopicDecision,
} from '@/lib/chat/topic-decision';

test('no row is no decision', () => {
  assert.deepEqual(readTopicDecision(null), { kind: 'none' });
  assert.deepEqual(readTopicDecision(undefined), { kind: 'none' });
});

test('an open dialogue reports the phase it is in', () => {
  const d = readTopicDecision({ phase: 'respond', opened_at: '2026-09-01T10:00:00Z' });
  assert.equal(d.kind, 'open');
  assert.equal(d.kind === 'open' && d.phase, 'respond');
});

test('a row with an unreadable phase is still shown as open', () => {
  // Something is happening in this topic. Showing nothing is the one answer
  // that is definitely wrong.
  const d = readTopicDecision({ phase: 'nonsense' });
  assert.equal(d.kind, 'open');
  assert.equal(d.kind === 'open' && d.phase, 'situation');
});

test('a decided dialogue is decided', () => {
  const d = readTopicDecision({
    phase: 'decided',
    chosen_path: 'hybrid',
    chosen_note: 'Split the territory',
    decided_at: '2026-09-02T12:00:00Z',
  });
  assert.equal(d.kind, 'decided');
  assert.equal(d.kind === 'decided' && d.path, 'hybrid');
  assert.equal(d.kind === 'decided' && d.note, 'Split the territory');
});

test('DEFER is a decision, not an absence', () => {
  // The whole reason this module exists.
  const d = readTopicDecision({ phase: 'decided', chosen_path: 'defer' });
  assert.equal(d.kind, 'decided');
  assert.equal(d.kind === 'decided' && d.path, 'defer');
  const label = pathLabel('defer');
  assert.match(label, /wait/i);
  assert.ok(!/undecided|no decision|pending/i.test(label), 'a deferral read as unresolved');
});

test('a decided row with no path says so without inventing one', () => {
  const d = readTopicDecision({ phase: 'decided', chosen_path: 'weird' });
  assert.equal(d.kind === 'decided' && d.path, null);
  const label = pathLabel(null);
  assert.match(label, /recorded/i);
  // Must not claim a direction, and must not contradict the record by calling
  // a decided dialogue open.
  assert.ok(!/coach suggested|team’s own call/i.test(label));
});

test('a blank note is null, not an empty bubble', () => {
  const d = readTopicDecision({ phase: 'decided', chosen_path: 'user', chosen_note: '   ' });
  assert.equal(d.kind === 'decided' && d.note, null);
});

test('phase progress counts through all five', () => {
  assert.deepEqual(phaseStep('situation'), { step: 1, total: 5 });
  assert.deepEqual(phaseStep('decide'), { step: 4, total: 5 });
  assert.deepEqual(phaseStep('decided'), { step: 5, total: 5 });
});

test('every phase has plain-English wording', () => {
  for (const p of ['situation', 'elicit', 'respond', 'decide', 'decided'] as const) {
    const l = phaseLabel(p);
    assert.ok(l.length > 0);
    // No raw column values leaking to a rep.
    assert.notEqual(l, p);
  }
});

test('every path has plain-English wording', () => {
  for (const p of ['user', 'system', 'hybrid', 'defer'] as const) {
    assert.ok(pathLabel(p).length > 0);
    assert.notEqual(pathLabel(p), p);
  }
});

test('an open decision carries what is being decided', () => {
  // Without it the card reads "Decision open · step 2 of 5" — a progress bar
  // with no subject. A rep cannot tell whether it concerns their estate.
  const d = readTopicDecision({
    situation: 'Should we drop the price on Maple Estate?',
    phase: 'elicit',
    opened_at: '2026-09-01T09:00:00Z',
  });
  assert.equal(d.kind, 'open');
  assert.equal((d as { situation: string | null }).situation, 'Should we drop the price on Maple Estate?');
});

test('a decided decision carries its question too', () => {
  // A verdict without its question is unreadable: "Hybrid" tells a rep nothing.
  const d = readTopicDecision({
    situation: 'Should we drop the price?',
    phase: 'decided',
    chosen_path: 'hybrid',
    chosen_note: 'Hold the price, add the survey.',
    decided_at: '2026-09-02T09:00:00Z',
  });
  assert.equal(d.kind, 'decided');
  assert.equal((d as { situation: string | null }).situation, 'Should we drop the price?');
});

test('a decision with no situation recorded is null, never an empty string', () => {
  // The column is nullable and the screen must be able to tell "absent" from
  // "blank" to decide whether to render a heading at all.
  for (const v of [undefined, null, '', '   ']) {
    const d = readTopicDecision({ situation: v, phase: 'elicit' });
    assert.equal((d as { situation: string | null }).situation, null, `situation ${JSON.stringify(v)}`);
  }
});
