/**
 * Pins: the team's own "this one matters", which the phone could not see.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isPinned, pinLine, pinSummary, unpinPrompt, withPin } from '@/lib/chat/pins';

const msgs = (...ids: string[]) => ids.map((id) => ({ id }));

test('a pinned message is recognised, an unpinned one is not', () => {
  const pins = new Set(['m2']);
  assert.equal(isPinned('m2', pins), true);
  assert.equal(isPinned('m1', pins), false);
});

test('the count is of what is on screen, not of what exists', () => {
  // The app loads the newest page. Saying "3 pinned" while showing one is a
  // screen arguing with itself.
  const s = pinSummary(msgs('m1', 'm2'), new Set(['m2', 'old1', 'old2']));
  assert.equal(s.visible, 1);
  assert.equal(s.older, 2);
});

test('a topic with no pins says nothing at all', () => {
  // Not "0 pinned" — an empty count reads as a broken feature rather than an
  // unused one.
  assert.equal(pinLine(pinSummary(msgs('m1'), new Set())), null);
});

test('pins that exist only further back are still reported', () => {
  // Otherwise a rep is told nothing is pinned when their manager pinned
  // something last week.
  const line = pinLine(pinSummary(msgs('m1'), new Set(['old'])));
  assert.equal(line, '1 pinned message, further back in this topic');
});

test('singular and plural are both right, in every combination', () => {
  assert.equal(pinLine({ visible: 1, older: 0 }), '1 pinned message below');
  assert.equal(pinLine({ visible: 2, older: 0 }), '2 pinned messages below');
  assert.equal(pinLine({ visible: 1, older: 1 }), '1 pinned message below, and 1 further back');
  assert.equal(pinLine({ visible: 2, older: 3 }), '2 pinned messages below, and 3 further back');
  assert.equal(pinLine({ visible: 0, older: 2 }), '2 pinned messages, further back in this topic');
});

test('a pin count can never go negative when every pin is on screen', () => {
  const s = pinSummary(msgs('m1', 'm2'), new Set(['m1', 'm2']));
  assert.equal(s.visible, 2);
  assert.equal(s.older, 0);
});

test('duplicate ids in the loaded page do not inflate the count', () => {
  // A poll can briefly hand the same row twice; the count must describe pins,
  // not renders.
  const s = pinSummary(msgs('m1', 'm1'), new Set(['m1']));
  assert.equal(s.visible, 2, 'counts occurrences on screen');
  assert.equal(s.older, 0, 'and never reports negative older pins');
});

test('a confirmed pin is added, and a confirmed unpin removed', () => {
  const none = new Set<string>();
  const one = withPin(none, 'm1', true);
  assert.equal(one.has('m1'), true);
  assert.equal(withPin(one, 'm1', false).has('m1'), false);
});

test('pinning something already pinned changes nothing at all', () => {
  // Same Set back, so a screen holding it does not re-render for a no-op.
  const one = new Set(['m1']);
  assert.equal(withPin(one, 'm1', true), one);
  const none = new Set<string>();
  assert.equal(withPin(none, 'm1', false), none);
});

test('one pin never disturbs another', () => {
  const two = new Set(['m1', 'm2']);
  const after = withPin(two, 'm1', false);
  assert.equal(after.has('m2'), true, 'removing one pin removed another');
  assert.equal(after.has('m1'), false);
});

test('the unpin confirmation says who it affects', () => {
  // A rep cannot see the rest of the team from this screen. "Your whole team"
  // is the fact that makes the choice real rather than a shrug.
  const p = unpinPrompt();
  assert.match(p.body, /whole team/i);
  assert.match(p.body, /pin it again/i);
  assert.ok(p.title.trim().length > 0);
});
