/**
 * What a rep is shown when the coach reads a pasted conversation.
 *
 * Found on TestFlight, 4 September: the screen printed
 * `{ "dissect": { "hasSignal": false, "summary": "", ... } }` under the heading "WHAT THE COACH READS IN THIS".
 * Two failures at once — the response shape was never read, and `hasSignal: false` was ignored. The second is the
 * worse one: it is the server saying "there was nothing here", and the app rendered the empty structure instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_SIGNAL_TEXT,
  UNREADABLE_TEXT,
  dissectView,
  isPlanBlocked,
  planBlockedMessage,
  readDissect,
} from '@/lib/chat/dissect-view';

const EMPTY = {
  dissect: { hasSignal: false, summary: '', strengths: [], opportunity: '', nextMove: '', guidingQuestion: '' },
};

const REAL = {
  dissect: {
    hasSignal: true,
    summary: 'They are still using a competitor and have not been asked why.',
    strengths: [{ point: 'You named the competitor rather than guessing', excerpt: 'Was that Direct or Comcast?' }],
    opportunity: 'You moved to the offer before finding out what they dislike about it.',
    nextMove: 'Ask what made them choose it, then what they would change.',
    guidingQuestion: 'What do you think they were not telling you?',
  },
};

test('NEVER renders JSON — the defect that started this', () => {
  for (const payload of [EMPTY, REAL, {}, null, { dissect: 'nonsense' }]) {
    const v = dissectView(payload);
    const text = v.kind === 'read' ? v.text : '';
    assert.ok(!text.includes('{') && !text.includes('"hasSignal"'), 'a structure reached the screen');
  }
});

test('an empty read says there was nothing, rather than showing empty sections', () => {
  assert.deepEqual(dissectView(EMPTY), { kind: 'no-signal' });
  assert.match(NO_SIGNAL_TEXT, /not enough in this conversation/i);
  // And it tells them what would help, rather than only what went wrong.
  assert.match(NO_SIGNAL_TEXT, /paste more/i);
});

test('a real read comes back as prose, with each strength carrying its quote', () => {
  const v = dissectView(REAL);
  assert.equal(v.kind, 'read');
  if (v.kind !== 'read') return;
  assert.match(v.text, /still using a competitor/);
  assert.match(v.text, /What is working/);
  assert.match(v.text, /Was that Direct or Comcast\?/, 'the quote that makes the point checkable was dropped');
  assert.match(v.text, /The opportunity/);
  assert.match(v.text, /Your next move/);
  // The guiding question comes LAST — it invites the rep's own read rather than
  // closing on an instruction.
  assert.ok(v.text.trimEnd().endsWith('What do you think they were not telling you?'));
});

test('an empty section draws no heading', () => {
  const v = dissectView({
    dissect: { hasSignal: true, summary: 'Short read.', strengths: [], opportunity: '', nextMove: '', guidingQuestion: '' },
  });
  assert.equal(v.kind, 'read');
  if (v.kind !== 'read') return;
  // A heading with nothing under it reads as a finding the coach declined to explain.
  assert.ok(!/What is working|The opportunity|Your next move/.test(v.text));
  assert.equal(v.text, 'Short read.');
});

test('claimed signal with every field empty is still NO signal', () => {
  // The server should not do this, but "hasSignal: true" plus nothing at all is
  // not a read, and rendering it would produce a blank card with a heading.
  const v = dissectView({
    dissect: { hasSignal: true, summary: '', strengths: [], opportunity: '', nextMove: '', guidingQuestion: '' },
  });
  assert.deepEqual(v, { kind: 'no-signal' });
});

test('a shape this app does not know is UNREADABLE, never a guess', () => {
  for (const payload of [{}, null, undefined, { dissect: null }, { dissect: { summary: 'no flag' } }]) {
    assert.deepEqual(dissectView(payload), { kind: 'unreadable' }, `guessed at ${JSON.stringify(payload)}`);
  }
  assert.match(UNREADABLE_TEXT, /needs somebody to look at the server/i);
  // And it does not blame the rep's conversation.
  assert.match(UNREADABLE_TEXT, /Nothing is wrong with your conversation/i);
});

test('a strength with no point is dropped, one with no quote still shows', () => {
  const d = readDissect({
    dissect: {
      hasSignal: true,
      summary: '',
      strengths: [{ point: '', excerpt: 'orphan quote' }, { point: 'kept', excerpt: '' }],
      opportunity: '',
      nextMove: '',
      guidingQuestion: '',
    },
  });
  assert.equal(d?.strengths.length, 1);
  assert.equal(d?.strengths[0].point, 'kept');
});

test('hasSignal:false WINS even when a field has text in it', () => {
  /**
   * THE GAP MY OWN TEST MISSED, found by mutation.
   *
   * Deleting the `hasSignal` check still passed, because the empty payload has
   * no content either and the "nothing to show" guard caught it. That made the
   * flag look tested when only its side effect was.
   *
   * `hasSignal` is the SERVER'S authority on whether the conversation was worth
   * reading — the route's own comment is "never a fabricated read". If it says
   * no while a field still holds text, the flag wins: showing that text would
   * be presenting something the coach explicitly declined to stand behind.
   */
  const v = dissectView({
    dissect: {
      hasSignal: false,
      summary: 'a leftover half-sentence the model produced anyway',
      strengths: [{ point: 'something', excerpt: 'a line' }],
      opportunity: 'and this',
      nextMove: '',
      guidingQuestion: '',
    },
  });
  assert.deepEqual(v, { kind: 'no-signal' }, 'content overrode the server saying there was no signal');
});

// ---------------------------------------------------------------------------
// A locked plan, said in the app's own terms
// ---------------------------------------------------------------------------

test('a 402 is recognised as a plan problem, not an auth one', () => {
  assert.equal(isPlanBlocked({ status: 402 }), true);
  for (const other of [{ status: 401 }, { status: 403 }, { status: 500 }, null, undefined, {}]) {
    assert.equal(isPlanBlocked(other), false, `${JSON.stringify(other)} was treated as a plan block`);
  }
});

test('the message names the APP, not the browser extension', () => {
  // The shared route labels itself "Sales Coach extension". True, and confusing
  // on a phone — a rep reads that they are missing a browser add-on they have
  // never seen, and concludes the app is talking about the wrong product.
  const m = planBlockedMessage("Your plan doesn't include the Sales Coach extension.");
  assert.ok(!/extension/i.test(m), 'the phone told a rep about a browser extension');
  assert.match(m, /plan does not include the coach/i);
  assert.match(m, /administrator/i, 'it does not say who can fix it');
});

test('an ended trial is kept apart from a plan that never included it', () => {
  // They send a rep to different conversations with different people.
  const ended = planBlockedMessage('Your 14-day Sales Coach extension trial has ended.');
  const never = planBlockedMessage("Your plan doesn't include the Sales Coach extension.");
  assert.match(ended, /trial of the coach has ended/i);
  assert.notEqual(ended, never);
  assert.ok(!/extension/i.test(ended));
});

test('a missing server message still produces something actionable', () => {
  for (const m of [null, undefined, '']) {
    const text = planBlockedMessage(m);
    assert.match(text, /administrator/i);
    assert.ok(text.length > 20);
  }
});
