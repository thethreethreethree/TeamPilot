/**
 * Regression tests for the roleplay bounds.
 *
 * THE FAILURE HERE COSTS A RUN. The route is stateless by design — its own
 * comment says a roleplay "must NOT pollute the rep's session history or
 * metrics" — so nothing is persisted anywhere. The phone is the only place a
 * practice run exists while it is happening, which makes two limits sharp:
 *
 *   1. The route caps `messages` at 80 and REFUSES an over-long conversation
 *      with a 400 rather than trimming it. A rep who discovers that mid-flow has
 *      lost everything they typed. So the screen has to warn before the wall,
 *      and the count it warns from has to be right.
 *
 *   2. The route will happily "review" two lines. A rep who gets coaching on one
 *      exchange learns the review is cheap and stops reading them, so there is a
 *      floor on what is worth reviewing.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canReview,
  turnsRemaining,
  MAX_MESSAGES,
  MIN_REP_TURNS_FOR_REVIEW,
  PERSONAS,
  type RoleplayMessage,
} from '@/lib/roleplay-bounds';

/** n complete exchanges: the rep speaks, the prospect answers. */
function run(exchanges: number): RoleplayMessage[] {
  const out: RoleplayMessage[] = [];
  for (let i = 0; i < exchanges; i++) {
    out.push({ role: 'rep', text: `rep ${i}` });
    out.push({ role: 'prospect', text: `prospect ${i}` });
  }
  return out;
}

test('a fresh run has room for the full conversation', () => {
  assert.equal(turnsRemaining([]), MAX_MESSAGES / 2);
});

test('each exchange costs exactly one turn', () => {
  assert.equal(turnsRemaining(run(1)), MAX_MESSAGES / 2 - 1);
  assert.equal(turnsRemaining(run(10)), MAX_MESSAGES / 2 - 10);
});

test('a full conversation reports no turns left, never a negative', () => {
  // Negative would read as "-3 more turns" on screen, and would make the
  // greater-than-zero guard on the send button behave unpredictably.
  assert.equal(turnsRemaining(run(MAX_MESSAGES / 2)), 0);
  assert.equal(turnsRemaining(run(MAX_MESSAGES)), 0);
});

test('the count leaves room for the reply, not just the rep’s line', () => {
  // Each turn is TWO messages. Counting only the rep's would let the screen
  // promise a turn that the route then refuses — the exact loss this guards.
  const nearlyFull = run(MAX_MESSAGES / 2 - 1);
  assert.equal(turnsRemaining(nearlyFull), 1);
  assert.equal(nearlyFull.length + 2, MAX_MESSAGES);
});

test('one exchange is not enough to be worth reviewing', () => {
  assert.equal(canReview(run(1)), false);
  assert.equal(canReview([]), false);
});

test('the review unlocks at the stated floor and stays unlocked', () => {
  assert.equal(canReview(run(MIN_REP_TURNS_FOR_REVIEW - 1)), false);
  assert.equal(canReview(run(MIN_REP_TURNS_FOR_REVIEW)), true);
  assert.equal(canReview(run(MIN_REP_TURNS_FOR_REVIEW + 5)), true);
});

test('only the rep’s turns count toward the review floor', () => {
  // A prospect that answers twice in a row must not unlock the review — the
  // thing being reviewed is what the REP said.
  const lopsided: RoleplayMessage[] = [
    { role: 'rep', text: 'hello' },
    { role: 'prospect', text: 'a' },
    { role: 'prospect', text: 'b' },
    { role: 'prospect', text: 'c' },
    { role: 'prospect', text: 'd' },
  ];
  assert.equal(canReview(lopsided), false);
});

test('the personas match the web word for word', () => {
  // Practice must mean the same thing in both products. A reworded persona here
  // would produce a different prospect from the same choice.
  assert.deepEqual(
    PERSONAS.map((p) => p.label),
    ['Skeptical & guarded', 'Busy & rushed', 'Price-focused', 'Friendly but non-committal'],
  );
});
