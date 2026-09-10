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
  readIssueFor,
  latestAttemptBySession,
  sessionIdFromSubject,
  type AttemptEvent,
} from '@/lib/capture-issue';

const SID = '9fe54cd9-8f11-4497-bd90-2aabc7b3bd62';

test('a one-sided recording with no read is reported as one-sided', () => {
  assert.equal(readIssueFor(false, 'no_agent_turns'), 'one-sided');
});

test('a call that was captured fine is NEVER called one-sided', () => {
  // no_signal means the rep WAS recorded and the conversation was thin. Telling
  // them their audio failed sends them to re-record a call that is fine.
  assert.equal(readIssueFor(false, 'no_signal'), null);
  assert.equal(readIssueFor(false, null), null);
  assert.equal(readIssueFor(false, undefined), null);
});

test('a later dissect clears the badge, because the call was rescued', () => {
  // Re-transcribing or re-labelling the speakers recovers a one-sided call. The
  // badge must go, not linger as a permanent mark against a call that is now fine.
  assert.equal(readIssueFor(true, 'no_agent_turns'), null);
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
  assert.equal(latestAttemptBySession(events).get(SID)?.reason, 'no_agent_turns');
  // Reversed input must give the same answer — array order is not a timestamp.
  assert.equal(latestAttemptBySession([...events].reverse()).get(SID)?.reason, 'no_agent_turns');
});

test('an undated event never outranks a dated one', () => {
  const events: AttemptEvent[] = [
    { subject: `sales_session:${SID}`, createdAt: '2026-09-10T10:00:00Z', reason: 'no_signal' },
    { subject: `sales_session:${SID}`, createdAt: null, reason: 'no_agent_turns' },
  ];
  assert.equal(latestAttemptBySession(events).get(SID)?.reason, 'no_signal');
});

test('rows that cannot be placed are dropped rather than guessed at', () => {
  const events: AttemptEvent[] = [
    { subject: null, createdAt: '2026-09-10T10:00:00Z', reason: 'no_agent_turns' },
    { subject: `sales_session:${SID}`, createdAt: '2026-09-10T10:00:00Z', reason: null },
  ];
  assert.equal(latestAttemptBySession(events).size, 0);
});

test('the explanation says what happened AND how to recover it', () => {
  assert.match(ONE_SIDED_BODY, /not captured/);
  assert.match(ONE_SIDED_BODY, /Re-record|set which voice/);
  // It must not read as the app being broken, nor as work still in progress.
  assert.ok(!/error|failed|went wrong|processing|still being/i.test(ONE_SIDED_BODY));
});

/**
 * WHICH no-signal, and therefore what a rep should do about it (2026-09-10, server 3828776b).
 *
 * Measured on production: 92 of 100 stored declines say `no_signal`, and they are systematically the
 * LONGER calls — median 683 transcript words against 341 for the ones that succeeded. Thin content would
 * be SHORT. So for most of these the rep did nothing wrong and was shown NOTHING AT ALL: no read, no
 * chip, no explanation, on more than half of every session recorded.
 *
 * The old rule — never call a `no_signal` session a capture problem — is right and is kept. What changes
 * is that a coach that CRASHED is now told apart from a coach that read the call and found little.
 */
test('a model that returned nothing reads as unfinished — the coach failed, not the call', () => {
  assert.equal(readIssueFor(false, 'no_signal', 'llm_empty'), 'unfinished');
});

test('an unreadable answer and a thrown error read as unfinished too', () => {
  assert.equal(readIssueFor(false, 'no_signal', 'unparsable'), 'unfinished');
  assert.equal(readIssueFor(false, 'no_signal', 'threw'), 'unfinished');
});

test('a call the coach READ and found little in stays silent — no retry for a call with nothing to give', () => {
  assert.equal(readIssueFor(false, 'no_signal', 'no_strengths'), null);
});

test('a policy decline stays silent — nothing failed', () => {
  assert.equal(readIssueFor(false, 'no_signal', 'suppressed'), null);
});

test('an OLDER decline carries no shape and stays silent — we do not know, so we do not guess', () => {
  assert.equal(readIssueFor(false, 'no_signal', null), null);
  assert.equal(readIssueFor(false, 'no_signal', undefined), null);
});

test('one-sided still wins over any shape — it is the capture problem, and it is fixable', () => {
  assert.equal(readIssueFor(false, 'no_agent_turns', 'llm_empty'), 'one-sided');
  assert.equal(readIssueFor(false, 'no_agent_turns', 'no_agent_turns'), 'one-sided');
});

test('a session that HAS a read shows nothing, whatever an older attempt said', () => {
  assert.equal(readIssueFor(true, 'no_signal', 'llm_empty'), null);
  assert.equal(readIssueFor(true, 'no_agent_turns', 'threw'), null);
});

test('the latest attempt carries its shape, and an older one does not overwrite it', () => {
  const at = (createdAt: string, reason: 'no_signal', shape: 'llm_empty' | 'no_strengths' | null) => ({
    subject: `sales_session:${SID}`,
    createdAt,
    reason,
    shape,
  });
  const events = [
    at('2026-09-01T00:00:00Z', 'no_signal', 'no_strengths'),
    at('2026-09-10T00:00:00Z', 'no_signal', 'llm_empty'),
  ];
  assert.equal(latestAttemptBySession(events).get(SID)?.shape, 'llm_empty');
  assert.equal(latestAttemptBySession([...events].reverse()).get(SID)?.shape, 'llm_empty');
});

test('an attempt with no shape reduces to a null shape, never to undefined', () => {
  const events = [{ subject: `sales_session:${SID}`, createdAt: '2026-08-01T00:00:00Z', reason: 'no_signal' as const }];
  const got = latestAttemptBySession(events).get(SID);
  assert.equal(got?.reason, 'no_signal');
  assert.equal(got?.shape, null);
});
