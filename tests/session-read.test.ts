import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canRetryRead,
  hasReadableSpeech,
  noReadReason,
  noReadWording,
  readSections,
  type SessionRead,
} from '../src/lib/session-read';

const seg = (speaker: string, text: string) => ({ speaker, text });
const REAL = [seg('agent', 'Morning, I am from Elostate.'), seg('customer', 'How much is it?')];

const read = (over: Partial<SessionRead> = {}): SessionRead => ({
  hasSignal: true,
  strengths: [{ point: 'clear opener', example: 'you led with the offer', why: 'earns the first moments' }],
  growthAreas: [],
  standoutStrategy: null,
  ...over,
});

test('a read with signal means there is nothing to explain', () => {
  assert.equal(noReadReason({ read: read(), segments: REAL }), null);
});

test('no read and nobody has asked → never-made, and a rep can ask', () => {
  const r = noReadReason({ read: null, segments: REAL });
  assert.equal(r, 'never-made');
  assert.equal(canRetryRead(r), true);
});

test('the coach ran and produced nothing → unfinished, and a rep can retry', () => {
  const r = noReadReason({ read: null, segments: REAL, attemptFailed: true });
  assert.equal(r, 'unfinished');
  assert.equal(canRetryRead(r), true);
});

/**
 * The case this whole build came from. Measured 2026-09-10: 24 of 45 graded door pitches in one company
 * had a transcript of a single bracketed sound and not one word of speech.
 */
test('a transcript of nothing but sound events → no-speech, and NO button', () => {
  const r = noReadReason({ read: null, segments: [seg('agent', '[clicking]'), seg('agent', '[pause]')] });
  assert.equal(r, 'no-speech');
  assert.equal(canRetryRead(r), false, 'a button here would spend a real LLM call to produce the same empty answer');
});

test('no-speech wins even when the coach is known to have failed — there was nothing to read either way', () => {
  assert.equal(
    noReadReason({ read: null, segments: [seg('agent', '[outro jingle]')], attemptFailed: true }),
    'no-speech',
  );
});

test('a customer-only transcript has nothing for the coach to read about the REP', () => {
  assert.equal(noReadReason({ read: null, segments: [seg('customer', 'Not interested, thanks.')] }), 'no-speech');
});

test('an annotation MIXED with speech is a real call', () => {
  assert.equal(hasReadableSpeech([seg('agent', "[background noise] Hi, I'm John.")]), true);
});

test('an empty transcript is not something to retry into', () => {
  assert.equal(noReadReason({ read: null, segments: [] }), 'no-speech');
});

test('a read that came back WITHOUT signal is treated as no read at all', () => {
  const r = noReadReason({ read: read({ hasSignal: false, strengths: [] }), segments: REAL, attemptFailed: true });
  assert.equal(r, 'unfinished');
});

test('the no-speech wording never blames the rep', () => {
  const w = noReadWording('no-speech');
  assert.match(w.body, /did not catch you speaking/);
  assert.ok(!/not enough of a conversation/i.test(w.body), 'that sentence was taken back once already');
  assert.equal(w.action, undefined, 'no action means no button');
});

test('the unfinished wording says whose fault it is not, and offers a way out', () => {
  const w = noReadWording('unfinished');
  assert.match(w.body, /Your recording is fine/);
  assert.equal(w.action, 'Try again');
});

test('sections are counted from what the read actually carries', () => {
  const s = readSections(
    read({
      growthAreas: [{ opportunity: 'ask more', nextStep: 'prepare two questions', why: 'thin discovery' }],
      standoutStrategy: { name: 'Assumptive close', example: 'which day suits', why: 'moves to logistics' },
      overall: 'solid short call',
    }),
  );
  assert.deepEqual(s, { strengths: 1, growth: 1, hasStrategy: true, hasOverall: true });
});

test('a blank strategy name is not a strategy — the card must not draw an empty heading', () => {
  const s = readSections(read({ standoutStrategy: { name: '   ', example: '', why: '' } }));
  assert.equal(s.hasStrategy, false);
});

/**
 * THE ONE I NEARLY SHIPPED WITHOUT.
 *
 * Tap "Try again", wait, and the read comes back empty a second time — and the card went straight back to
 * the identical sentence and the identical button. Nothing said the attempt had run. A rep would tap it
 * forever while the screen kept implying it was worth another go.
 *
 * That is precisely the disease this whole build is about — a path that produces nothing while nothing
 * says so — in the feature built to cure it.
 */
test('a retry that produced nothing gets its own state, not the same message again', () => {
  const r = noReadReason({ read: null, segments: REAL, attemptFailed: true, justTried: true });
  assert.equal(r, 'retried-and-failed');
  assert.notEqual(r, 'unfinished', 'the same sentence twice reads as though nothing happened');
});

test('and it offers NO button — a second identical button invites paying for the same nothing', () => {
  assert.equal(canRetryRead('retried-and-failed'), false);
});

test('its words say the recording is safe, and that asking again will most likely do this', () => {
  const w = noReadWording('retried-and-failed');
  assert.match(w.title, /did not work either/);
  assert.match(w.body, /your words are safe/i);
  assert.match(w.body, /most likely do the same/);
  assert.equal(w.action, undefined);
});

test('a retry that SUCCEEDED shows the read, never the failure state', () => {
  assert.equal(noReadReason({ read: read(), segments: REAL, justTried: true }), null);
});

test('no-speech still wins over a failed retry — there was nothing to read either way', () => {
  assert.equal(
    noReadReason({ read: null, segments: [seg('agent', '[clicking]')], justTried: true }),
    'no-speech',
  );
});
