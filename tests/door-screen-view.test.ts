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
  NO_GOAL_BODY,
  dateEyebrow,
  doorScreenState,
  greeting,
  partOfDay,
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
  assert.equal(dateEyebrow('2026-09-10'), 'Thursday, 10 September');
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
