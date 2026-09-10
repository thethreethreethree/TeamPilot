import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyNote,
  hasCoachingContent,
  inServerOrder,
  materialLine,
  signalCount,
  type TeamMember,
} from '../src/lib/coach-assessment';

const m = (over: Partial<TeamMember> = {}): TeamMember => ({
  agentId: 'a1',
  agentName: 'Moses Maniquiz',
  dissectCount: 0,
  pitchCount: 0,
  strengths: [],
  growthAreas: [],
  strategies: [],
  lastAt: null,
  ...over,
});

/**
 * A18 / A10. The server's docblock is explicit: these coaching notes are NOT a scoreboard, and its order
 * is an org-chart order rather than a grade. A well-meaning `.sort()` in the app would turn a coaching
 * list into a league table without anybody deciding to. These pin the rule so that edit fails.
 */
test('the render order is exactly the order the server gave', () => {
  const team = [m({ agentId: 'b', agentName: 'Zoe', dissectCount: 1 }), m({ agentId: 'a', agentName: 'Adam', dissectCount: 40 })];
  assert.deepEqual(
    inServerOrder(team).map((x) => x.agentId),
    ['b', 'a'],
    'not alphabetical, and NOT by how much material anyone has — the server already decided',
  );
});

test('the busiest rep is not floated to the top', () => {
  const team = [m({ agentId: 'quiet', pitchCount: 0 }), m({ agentId: 'busy', pitchCount: 99 })];
  assert.equal(inServerOrder(team)[0].agentId, 'quiet');
});

test('a rep with nothing is still listed — a shorter list is a different answer', () => {
  const team = [m({ agentId: 'nothing' }), m({ agentId: 'something', strengths: ['clear opener'] })];
  assert.equal(inServerOrder(team).length, 2);
  assert.equal(hasCoachingContent(team[0]), false);
  assert.equal(hasCoachingContent(team[1]), true);
});

test('calls AND door pitches both count as coaching material', () => {
  assert.equal(signalCount(m({ dissectCount: 3, pitchCount: 12 })), 15);
});

test('growth notes alone are enough to have content — a rep is not hidden for having no strengths yet', () => {
  assert.equal(hasCoachingContent(m({ growthAreas: ['ask more questions'] })), true);
});

test('the empty note names the reason, never the rep', () => {
  const nothing = emptyNote(m());
  assert.match(nothing, /nothing to read/);
  const unread = emptyNote(m({ pitchCount: 4 }));
  assert.match(unread, /has not produced notes/);
  for (const note of [nothing, unread]) {
    assert.ok(!/lazy|behind|poor|failing|not working/i.test(note), 'this screen has no standing to judge a rep');
  }
});

test('the summary line counts MATERIAL, and says so in the rep\u2019s own units', () => {
  assert.equal(materialLine(m({ dissectCount: 1, pitchCount: 1 })), 'From 1 call and 1 door pitch');
  assert.equal(materialLine(m({ dissectCount: 3, pitchCount: 12 })), 'From 3 calls and 12 door pitches');
  assert.equal(materialLine(m({ dissectCount: 2 })), 'From 2 calls');
  assert.equal(materialLine(m({ pitchCount: 5 })), 'From 5 door pitches');
  assert.equal(materialLine(m()), 'Nothing recorded yet');
});

test('the summary line carries no rate, average or score', () => {
  const line = materialLine(m({ dissectCount: 3, pitchCount: 12 }));
  assert.ok(!/%|per |avg|average|rate|score|rank/i.test(line));
});
