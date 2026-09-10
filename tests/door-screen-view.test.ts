/**
 * The door home screen's six states, and its greeting.
 *
 * The state that matters is `no-goal`. A rep whose manager has not set a daily
 * goal is not broken and not loading — and rendering the dials anyway would show
 * three empty rings against a target of zero, which reads as "you have achieved
 * none of your goal" to the one rep who has no goal to achieve.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_PAGER_HINTS,
  NO_GOAL_BODY,
  dateEyebrow,
  doorScreenState,
  goalBasisLine,
  greeting,
  homePagerHint,
  partOfDay,
  pendingNote,
} from '@/lib/doors/door-screen-view';

const at = (h: number) => new Date(2026, 8, 10, h, 0, 0);

test('the part of day uses the ordinary English boundaries', () => {
  assert.equal(partOfDay(at(0)), 'Morning');
  assert.equal(partOfDay(at(11)), 'Morning');
  assert.equal(partOfDay(at(12)), 'Afternoon');
  assert.equal(partOfDay(at(17)), 'Afternoon');
  assert.equal(partOfDay(at(18)), 'Evening');
  assert.equal(partOfDay(at(23)), 'Evening');
});

test('the greeting is the mockup wording, with no "Good"', () => {
  assert.equal(greeting('Moses Maniquiz', null, at(14)), 'Afternoon, Moses');
  assert.ok(!greeting('Moses Maniquiz', null, at(9)).startsWith('Good'));
});

test('a missing name never leaves a dangling comma', () => {
  // "Afternoon," with nothing after it reads as a bug to the rep whose profile
  // simply has not loaded.
  assert.equal(greeting(null, null, at(14)), 'Afternoon');
  assert.equal(greeting('   ', null, at(9)), 'Morning');
});

test('the eyebrow is built from the SERVER local date, not the device clock', () => {
  // The server froze the target against a particular local day. A phone that has
  // ticked past midnight must not caption yesterday's target with today.
  // A MIDDLE DOT, matching the founder's mockup: "TUESDAY · 9 SEPTEMBER".
  // The screen uppercases it; the separator is decided here.
  assert.equal(dateEyebrow('2026-09-10'), 'Thursday · 10 September');
});

test('a malformed local date yields no eyebrow rather than a wrong one', () => {
  for (const bad of ['', '10-09-2026', 'today', '2026-13-45']) {
    const out = dateEyebrow(bad);
    assert.ok(out === '' || !/NaN|Invalid/.test(out), `bad date rendered as ${out}`);
  }
});

test('no goal is its own state, distinct from loading and from error', () => {
  const base = { loading: false, failure: null as null };
  assert.equal(doorScreenState({ ...base, salesGoal: null }), 'no-goal');
  assert.equal(doorScreenState({ ...base, salesGoal: 0 }), 'no-goal');
  assert.equal(doorScreenState({ ...base, salesGoal: -1 }), 'no-goal');
  assert.equal(doorScreenState({ ...base, salesGoal: 2 }), 'ready');
});

test('loading and failures win over the goal, in that order', () => {
  assert.equal(doorScreenState({ loading: true, failure: null, salesGoal: null }), 'loading');
  assert.equal(
    doorScreenState({ loading: false, failure: 'unavailable', salesGoal: 2 }),
    'unavailable',
  );
  assert.equal(doorScreenState({ loading: false, failure: 'error', salesGoal: 2 }), 'error');
});

test('the no-goal copy names who fixes it, because the rep cannot', () => {
  assert.match(NO_GOAL_BODY, /manager/i);
  assert.ok(!/error|wrong|failed/i.test(NO_GOAL_BODY));
});
test('doors this phone is still holding are named, never left to look like a shortfall', () => {
  // The dials read the SERVER's counts. A rep who knocked 8 with two still in the
  // outbox sees 6 — and without this line, 6 is indistinguishable from a true 6.
  assert.equal(pendingNote(0), null);
  assert.equal(pendingNote(-1), null);
  assert.match(pendingNote(1)!, /^1 door logged on this phone has not reached/);
  assert.match(pendingNote(2)!, /^2 doors logged on this phone have not reached/);
});

test('the pending line promises the work is not lost and asks nothing of the rep', () => {
  const line = pendingNote(3)!;
  assert.match(line, /send on their own/);
  // Never spatial — "not counted above" is meaningless in a screen reader.
  assert.ok(!/above|below|on the right|on the left/i.test(line), line);
  assert.ok(!/error|failed|lost/i.test(line), line);
});

test('the rep is told where their daily goal came from, in every case', () => {
  // The goal is derived automatically now. A number that appears from nowhere is
  // indistinguishable from one somebody guessed, and this screen's whole
  // argument is that it does not guess.
  for (const basis of ['manager', 'own-sales', 'own-activity', 'starter'] as const) {
    const line = goalBasisLine(basis, 2)!;
    assert.ok(line && line.length > 0, `${basis} said nothing`);
    assert.match(line, /2 sales/);
    assert.ok(!/error|failed|unknown/i.test(line), line);
  }
  assert.match(goalBasisLine('manager', 2)!, /manager/i);
  assert.match(goalBasisLine('own-activity', 2)!, /doors you have been knocking/i);
});

test('one sale reads as one sale, not "1 sales"', () => {
  assert.match(goalBasisLine('starter', 1)!, /1 sale a day/);
});

test('a server that says nothing gets NO line, never an invented reason', () => {
  // An older deployment, or a frozen row from before the derivation existed.
  assert.equal(goalBasisLine(null, 2), null);
});

// ---------------------------------------------------------------------------
// The pager hint — which is also the only labelled way off a page
//
// It stopped being decoration when the dots stopped being buttons. Two 6pt dots 14pt apart cannot each own a
// 44pt target: the hit rects overlap, the later sibling sits on top, and the first dot became untappable — so
// the page it led to was reachable by swipe alone, which is what the design law refuses. The hint line carries
// the label now, so its words are load-bearing.

test('each page names the OTHER one, so the hint never offers the page you are on', () => {
  assert.equal(HOME_PAGER_HINTS.length, 2, 'one sentence per page of the home pager');
  assert.notEqual(homePagerHint(0), homePagerHint(1));
  assert.match(homePagerHint(0), /home screen/i, 'page 0 is the door target, so it offers the home screen');
  assert.match(homePagerHint(1), /door target/i, 'page 1 is the home screen, so it offers the door target');
});

test('the hint says it can be tapped, because it is now the control', () => {
  HOME_PAGER_HINTS.forEach((line) => {
    assert.match(line, /tap/i, `"${line}" is the only labelled route off the page and must say so`);
  });
});

test('no hint names a swipe DIRECTION, which was wrong on one page by construction', () => {
  // "Swipe left for the original home screen" read identically on the home screen itself, where left leads
  // away from what the sentence offers. A hint that names the destination cannot go stale that way.
  HOME_PAGER_HINTS.forEach((line) => {
    assert.doesNotMatch(line, /\b(left|right)\b/i, `"${line}" names a direction that is wrong on one page`);
  });
});

test('an index outside the pages falls back rather than rendering undefined', () => {
  assert.equal(homePagerHint(9), HOME_PAGER_HINTS[0]);
  assert.equal(homePagerHint(-1), HOME_PAGER_HINTS[0]);
});
