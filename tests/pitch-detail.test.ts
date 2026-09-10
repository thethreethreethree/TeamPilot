/**
 * Regression tests for the per-pitch detail's four honest states.
 *
 * THE ONE THAT MATTERS MOST is `lost`: a pitch that COMPLETED but whose analysis
 * never saved. The obvious code — `analysis ? ready : processing` — shows that
 * rep "still processing", and it is not. The pitch is terminal. The spinner
 * resolves never, and the rep keeps reopening the screen to check.
 *
 * The web carries the same guard with an audit note (H3) beside it, which is how
 * this app knows the failure is real rather than theoretical.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analysisState,
  canRolePlay,
  dimensionLabel,
  orderedScores,
  scoreWidth,
  type PitchDetail,
} from '@/lib/pitch-detail';

const ANALYSIS = {
  summary: 'Strong open, lost them on price.',
  strengths: ['Warm open'],
  improvements: ['Anchor value before price'],
  scores: { rapport: 80, price_framing: 40 },
};

function pitch(over: Partial<PitchDetail> = {}): PitchDetail {
  return {
    id: 'p1',
    name: '14 Oak St',
    status: 'complete',
    error: null,
    recordedAt: '2026-09-03T14:00:00Z',
    outcome: 'sold',
    transcript: 'Hi there…',
    analysis: ANALYSIS,
    ...over,
  };
}

test('a completed pitch whose analysis never saved is LOST, not processing', () => {
  // The spinner would never resolve. This is the whole reason the module exists.
  const s = analysisState(pitch({ status: 'complete', analysis: null }));
  assert.equal(s.kind, 'lost');
});

test('a pitch still running IS processing', () => {
  assert.equal(analysisState(pitch({ status: 'processing', analysis: null })).kind, 'processing');
  assert.equal(analysisState(pitch({ status: 'transcribing', analysis: null })).kind, 'processing');
});

test('a failed pitch reports its real reason', () => {
  const s = analysisState(pitch({ status: 'failed', analysis: null, error: 'Audio too quiet' }));
  assert.equal(s.kind, 'failed');
  assert.equal(s.kind === 'failed' && s.message, 'Audio too quiet');
});

test('a failed pitch with no reason still says something', () => {
  // An empty failure bubble is worse than no card at all.
  const s = analysisState(pitch({ status: 'failed', analysis: null, error: null }));
  assert.equal(s.kind === 'failed' && s.message.length > 0, true);
  const blank = analysisState(pitch({ status: 'failed', analysis: null, error: '   ' }));
  assert.equal(blank.kind === 'failed' && blank.message.trim().length > 0, true);
});

test('failure beats a present analysis', () => {
  // A failed pitch that somehow carries an analysis row is still a failure; the
  // rep must not be shown scores for a pitch the system could not process.
  assert.equal(analysisState(pitch({ status: 'failed' })).kind, 'failed');
});

test('an analysis that is there is READY', () => {
  const s = analysisState(pitch());
  assert.equal(s.kind, 'ready');
  assert.equal(s.kind === 'ready' && s.analysis.summary, ANALYSIS.summary);
});

test('role play is offered only when there is a transcript to rebuild from', () => {
  // Without one the coach would invent a customer, which is the opposite of
  // "run this same pitch back".
  assert.equal(canRolePlay(pitch()), true);
  assert.equal(canRolePlay(pitch({ transcript: null })), false);
  assert.equal(canRolePlay(pitch({ transcript: '   ' })), false);
});

test('role play is never offered on a failed or unfinished pitch', () => {
  assert.equal(canRolePlay(pitch({ status: 'failed' })), false);
  assert.equal(canRolePlay(pitch({ status: 'processing' })), false);
});

test('a score bar never paints outside its track', () => {
  assert.equal(scoreWidth(150), 100);
  assert.equal(scoreWidth(-20), 0);
  assert.equal(scoreWidth(62), 62);
  // Garbage is not a score. `orderedScores` drops these before they reach a
  // bar, but if one ever did, an EMPTY bar is the safe wrong answer — clamping
  // Infinity to 100 would paint a perfect score out of corrupt data.
  assert.equal(scoreWidth(Number.NaN), 0);
  assert.equal(scoreWidth(Number.POSITIVE_INFINITY), 0);
});

test('scores are ordered the same way for every pitch', () => {
  // Insertion order would let two pitches list the same dimensions differently,
  // and a rep comparing them would read position as meaning.
  const a = orderedScores({ ...ANALYSIS, scores: { rapport: 1, close: 2 } });
  const b = orderedScores({ ...ANALYSIS, scores: { close: 2, rapport: 1 } });
  assert.deepEqual(a.map((s) => s.dimension), b.map((s) => s.dimension));
  assert.deepEqual(a.map((s) => s.dimension), ['close', 'rapport']);
});

test('a non-numeric score is dropped rather than rendered as a bar', () => {
  const rows = orderedScores({
    ...ANALYSIS,
    scores: { rapport: 80, broken: 'high' as unknown as number, missing: Number.NaN },
  });
  assert.deepEqual(rows.map((r) => r.dimension), ['rapport']);
});

test('an empty score set is empty, not a crash', () => {
  assert.deepEqual(orderedScores({ ...ANALYSIS, scores: {} }), []);
});

test('dimension names read as English', () => {
  assert.equal(dimensionLabel('price_framing'), 'Price framing');
  assert.equal(dimensionLabel('objection-handling'), 'Objection handling');
  assert.equal(dimensionLabel('rapport'), 'Rapport');
});
