/**
 * The honest reason a call has no coach read.
 *
 * These pin the two ways this verdict can lie to a rep: calling a properly
 * captured call "one-sided" (sending them to re-record something that recorded
 * fine), and leaving the badge on a call that has since been rescued.
 *
 * The subject-parsing test exists because the events column holds
 * `"sales_session:<uuid>"` rather than a bare id — a naive match finds nothing,
 * reports every session as fine, and looks exactly like a feature that works.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ONE_SIDED_BODY,
  captureIssueFor,
  latestReasonBySession,
  sessionIdFromSubject,
  type AttemptEvent,
} from '@/lib/capture-issue';

const SID = '9fe54cd9-8f11-4497-bd90-2aabc7b3bd62';

test('a one-sided recording with no read is reported as one-sided', () => {
  assert.equal(captureIssueFor(false, 'no_agent_turns'), 'one-sided');
});

test('a call that was captured fine is NEVER called one-sided', () => {
  // no_signal means the rep WAS recorded and the conversation was thin. Telling
  // them their audio failed sends them to re-record a call that is fine.
  assert.equal(captureIssueFor(false, 'no_signal'), null);
  assert.equal(captureIssueFor(false, null), null);
  assert.equal(captureIssueFor(false, undefined), null);
});

test('a later dissect clears the badge, because the call was rescued', () => {
  // Re-transcribing or re-labelling the speakers recovers a one-sided call. The
  // badge must go, not linger as a permanent mark against a call that is now fine.
  assert.equal(captureIssueFor(true, 'no_agent_turns'), null);
});

test('the session id is parsed from the real subject shape, not assumed', () => {
  assert.equal(sessionIdFromSubject(`sales_session:${SID}`), SID);
  // The shapes that must NOT be mistaken for a match.
  assert.equal(sessionIdFromSubject(SID), null, 'a bare id was accepted');
  assert.equal(sessionIdFromSubject('meeting_session:abc'), null, 'another subject type matched');
  assert.equal(sessionIdFromSubject('sales_session:'), null, 'an empty id was accepted');
  assert.equal(sessionIdFromSubject(null), null);
  assert.equal(sessionIdFromSubject(undefined), null);
});

test('the LATEST attempt decides, not the last one in the array', () => {
  // A session can be attempted repeatedly. Only the most recent verdict
  // describes the recording as it now stands.
  const events: AttemptEvent[] = [
    { subject: `sales_session:${SID}`, createdAt: '2026-09-10T10:00:00Z', reason: 'no_agent_turns' },
    { subject: `sales_session:${SID}`, createdAt: '2026-09-01T10:00:00Z', reason: 'no_signal' },
  ];
  assert.equal(latestReasonBySession(events).get(SID), 'no_agent_turns');
  // Reversed input must give the same answer — array order is not a timestamp.
  assert.equal(latestReasonBySession([...events].reverse()).get(SID), 'no_agent_turns');
});

test('an undated event never outranks a dated one', () => {
  const events: AttemptEvent[] = [
    { subject: `sales_session:${SID}`, createdAt: '2026-09-10T10:00:00Z', reason: 'no_signal' },
    { subject: `sales_session:${SID}`, createdAt: null, reason: 'no_agent_turns' },
  ];
  assert.equal(latestReasonBySession(events).get(SID), 'no_signal');
});

test('rows that cannot be placed are dropped rather than guessed at', () => {
  const events: AttemptEvent[] = [
    { subject: null, createdAt: '2026-09-10T10:00:00Z', reason: 'no_agent_turns' },
    { subject: `sales_session:${SID}`, createdAt: '2026-09-10T10:00:00Z', reason: null },
  ];
  assert.equal(latestReasonBySession(events).size, 0);
});

test('the explanation says what happened AND how to recover it', () => {
  assert.match(ONE_SIDED_BODY, /not captured/);
  assert.match(ONE_SIDED_BODY, /Re-record|set which voice/);
  // It must not read as the app being broken, nor as work still in progress.
  assert.ok(!/error|failed|went wrong|processing|still being/i.test(ONE_SIDED_BODY));
});
