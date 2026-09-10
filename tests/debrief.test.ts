/**
 * Regression tests for the coach's debrief on a closed topic.
 *
 * THE RULE: an absent debrief is NORMAL, and an empty one is absent.
 *
 * Topics closed before this feature existed have no debrief, and one closed from
 * the phone has none until somebody opens it on the website. So there is no
 * error state — the card is simply not shown. Rendering an empty card headed
 * "What you learned" would tell a rep the coach had nothing to say about their
 * conversation, which is a different and much worse claim than saying nothing.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readDebrief } from '@/lib/chat/debrief';

test('a real payload reads back', () => {
  const d = readDebrief({
    learned: ['Price anchoring landed'],
    work_on: ['Slow down on the close'],
    closing: 'Good thread.',
  });
  assert.deepEqual(d, {
    learned: ['Price anchoring landed'],
    workOn: ['Slow down on the close'],
    closing: 'Good thread.',
  });
});

test('nothing at all is null, not an empty card', () => {
  assert.equal(readDebrief(null), null);
  assert.equal(readDebrief(undefined), null);
  assert.equal(readDebrief('nonsense'), null);
});

test('a payload with no usable content is null', () => {
  // The one that matters: an empty card headed "What you learned" tells a rep
  // the coach had nothing to say about their conversation.
  assert.equal(readDebrief({ learned: [], work_on: [], closing: '   ' }), null);
  assert.equal(readDebrief({}), null);
});

test('one usable field is enough to show the card', () => {
  assert.deepEqual(readDebrief({ work_on: ['Ask for the sale'] }), {
    learned: [],
    workOn: ['Ask for the sale'],
    closing: null,
  });
});

test('non-string entries are dropped rather than rendered', () => {
  const d = readDebrief({ learned: ['real', 42, null, '  ', 'also real'] });
  assert.deepEqual(d?.learned, ['real', 'also real']);
});

test('a non-array list does not crash or become a string', () => {
  assert.equal(readDebrief({ learned: 'not a list' }), null);
});

test('a blank closing is null rather than an empty line', () => {
  const d = readDebrief({ learned: ['x'], closing: '   ' });
  assert.equal(d?.closing, null);
});
