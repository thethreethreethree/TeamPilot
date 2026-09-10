/**
 * Regression tests for a manager's alerts (build spec 5.3).
 *
 * TWO RULES the obvious switch statement gets wrong.
 *
 * AN UNKNOWN TYPE IS SHOWN, NOT SWALLOWED. The spec's closing note says the web
 * may add a notification type first and the phone mirrors it after. A `default:
 * return null` would silently hide a manager's alerts about their own team — and
 * they would never know there was anything to miss.
 *
 * A MISSING NAME IS NOT INVENTED. `payload` carries the name so no join is
 * needed, but it can be absent. "A rep" is honest; a fabricated name on an alert
 * about somebody's performance is worse than no name at all.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isUnread,
  markReadFailureMessage,
  markReadLocally,
  notificationLine,
  unreadCount,
  type ManagerNotification,
} from '@/lib/gamification/notifications';

const n = (over: Partial<ManagerNotification> = {}): ManagerNotification => ({
  id: 'n1',
  agentId: 'a1',
  sessionId: 's1',
  type: 'strong_session',
  payload: { agent_name: 'Dana Ellis', points: 88 },
  createdAt: '2026-09-03T10:00:00Z',
  readAt: null,
  ...over,
});

test('a strong session names the rep and the score', () => {
  const line = notificationLine(n());
  assert.match(line.title, /Dana Ellis/);
  assert.match(line.detail, /88/);
});

test('a closed deal reads as a deal', () => {
  const line = notificationLine(n({ type: 'deal_closed', payload: { agent_name: 'Ben Cole' } }));
  assert.match(line.title, /Ben Cole/);
  assert.match(line.title, /closed a deal/i);
});

test('an UNKNOWN type is still shown', () => {
  // A `default: return null` would hide a manager's alerts about their own team.
  const line = notificationLine(n({ type: 'something_new', payload: { agent_name: 'Dana' } }));
  assert.ok(line.title.length > 0);
  assert.match(line.title, /Dana/);
  assert.match(line.detail, /website/i);
});

test('a missing name is NOT invented', () => {
  const line = notificationLine(n({ payload: { points: 90 } }));
  assert.match(line.title, /A rep/);
});

test('a blank name falls back too', () => {
  assert.match(notificationLine(n({ payload: { agent_name: '   ' } })).title, /A rep/);
});

test('a strong session with no score says so without a number', () => {
  const line = notificationLine(n({ payload: { agent_name: 'Dana' } }));
  assert.ok(!/\d/.test(line.detail), 'invented a score that was not in the payload');
});

test('a numeric score sent as a string still reads', () => {
  const line = notificationLine(n({ payload: { agent_name: 'Dana', points: '88' } }));
  assert.match(line.detail, /88/);
});

test('unread is decided by readAt, and counted', () => {
  assert.equal(isUnread(n()), true);
  assert.equal(isUnread(n({ readAt: '2026-09-03T11:00:00Z' })), false);
  assert.equal(
    unreadCount([n(), n({ id: 'n2', readAt: '2026-09-03T11:00:00Z' }), n({ id: 'n3' })]),
    2,
  );
});

test('an empty list has nothing unread', () => {
  assert.equal(unreadCount([]), 0);
});

test('marking one alert read leaves the others alone', () => {
  const rows: ManagerNotification[] = [
    { id: 'a', agentId: null, sessionId: null, type: 'strong_session', payload: {}, createdAt: '2026-09-01T00:00:00Z', readAt: null },
    { id: 'b', agentId: null, sessionId: null, type: 'deal_closed', payload: {}, createdAt: '2026-09-02T00:00:00Z', readAt: null },
  ];
  const next = markReadLocally(rows, ['a'], '2026-09-03T10:00:00Z');
  assert.equal(next[0].readAt, '2026-09-03T10:00:00Z');
  assert.equal(next[1].readAt, null, 'marking one alert read also marked another');
  assert.equal(unreadCount(next), 1);
});

test('an already-read alert keeps its original timestamp', () => {
  // Moving it to today would misreport when the manager actually read it, and
  // the server updates only rows whose read_at is null.
  const rows: ManagerNotification[] = [
    { id: 'a', agentId: null, sessionId: null, type: 'deal_closed', payload: {}, createdAt: '2026-09-01T00:00:00Z', readAt: '2026-09-01T09:00:00Z' },
  ];
  const next = markReadLocally(rows, ['a'], '2026-09-03T10:00:00Z');
  assert.equal(next[0].readAt, '2026-09-01T09:00:00Z');
});

test('marking nothing returns the very same array, so the screen does not re-render', () => {
  const rows: ManagerNotification[] = [
    { id: 'a', agentId: null, sessionId: null, type: 'deal_closed', payload: {}, createdAt: '2026-09-01T00:00:00Z', readAt: '2026-09-01T09:00:00Z' },
  ];
  assert.equal(markReadLocally(rows, ['a'], '2026-09-03T10:00:00Z'), rows);
  assert.equal(markReadLocally(rows, [], '2026-09-03T10:00:00Z'), rows);
  assert.equal(markReadLocally(rows, ['nope'], '2026-09-03T10:00:00Z'), rows);
});

test('a signed-out manager is told to sign in, not to wait for a deploy', () => {
  // The regression this function exists to prevent. The old code answered every 401 with "needs a change on the
  // website that has not gone live yet" — so a manager whose session had simply expired waited for a deploy that
  // would never fix it. The verdict comes from coach-api, AFTER its one refresh; it is consumed, not re-derived.
  const msg = markReadFailureMessage(401, 'signed-out');
  assert.match(msg, /sign in again/i);
  assert.ok(!/has not gone live/i.test(msg), 'a signed-out manager must not be told to wait for a deploy');
});

test('a 401 on a LIVE session does not throw the manager at a login screen', () => {
  const msg = markReadFailureMessage(401, 'route');
  assert.ok(!/sign in again to see this/i.test(msg));
  assert.notEqual(msg, markReadFailureMessage(401, 'signed-out'));
});

test('an unclassifiable 401 falls back to the route verdict', () => {
  // Guessing "signed out" would throw a working manager back to a login screen and lose what they were holding —
  // the more expensive of the two mistakes by a wide margin.
  assert.equal(markReadFailureMessage(401, null), markReadFailureMessage(401, 'route'));
});

test('a 403 is about the account, not the network — it does not say "try again"', () => {
  const msg = markReadFailureMessage(403, null);
  assert.match(msg, /account/i);
  assert.ok(!/try again/i.test(msg), 'retrying cannot turn a rep into a manager');
});

test('anything else is a save that did not land, and IS worth retrying', () => {
  for (const s of [500, 502, undefined]) {
    const msg = markReadFailureMessage(s, null);
    assert.match(msg, /try again/i);
    assert.match(msg, /unchanged/i);
  }
});
