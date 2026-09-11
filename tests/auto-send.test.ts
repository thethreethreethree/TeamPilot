/**
 * Regression tests for automatic sending.
 *
 * WHAT GOES WRONG HERE IS NEVER A CRASH. It is a phone that spends the working
 * day retrying a 25 MB upload against a server that will refuse it every time,
 * on a battery the rep cannot charge. So the tests that matter are the ones about
 * NOT sending: the cooldown, the attempt cap, and the hard stop on the failure
 * that retrying cannot fix.
 *
 * The other half is consent. Auto-send may only touch a recording the rep has
 * named, because naming it is how they say it should go. A test that lets an
 * unnamed recording through would be permitting the app to upload a conversation
 * on its own initiative.
 *
 * The sender is injected, not mocked: this file is about the DECISION to send,
 * not about the four HTTP steps, which have their own contract. That also keeps
 * the test off the filesystem and HTTP modules the real uploader pulls in.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addRecording,
  updateRecording,
  listRecordings,
  type PendingRecording,
} from '@/lib/audio/recording-store';
import {
  type AutoSendResult,
  runAutoSend,
  clearAutoSendStop,
  autoSendStopped,
  __resetAutoSend,
  isSendable,
  autoSendGaveUp,
  MAX_AUTO_ATTEMPTS,
  type Sender,
} from '@/lib/audio/auto-send';
import type { UploadOutcome } from '@/lib/audio/upload';

/** Distinct, increasing timestamps. Two recordings a second apart is realistic,
 *  and identical ones would make the oldest-first ordering arbitrary — a test
 *  that passes on tie-breaking luck is not a test. */
let clock = 0;
const add = (clientId: string, over: { label?: string | null } = {}) =>
  addRecording('rep-1', {
    clientId,
    fileUri: `file:///docs/${clientId}.m4a`,
    sizeBytes: 1_000_000,
    durationMs: 60_000,
    mimeType: 'audio/m4a',
    recordedAt: new Date(Date.UTC(2026, 8, 2, 10, 0, clock++)).toISOString(),
    label: 'label' in over ? (over.label ?? null) : 'Rowan & Co',
  });

/** A sender that records what it was asked to send and returns a fixed verdict. */
function stubUpload(outcome: (clientId: string) => UploadOutcome) {
  const calls: string[] = [];
  /** The NAME each recording actually went under. Separate from `calls` so every existing
   *  assertion on that array keeps working unchanged. */
  const labels: string[] = [];
  const send: Sender = async (userId, rec: PendingRecording, meta) => {
    calls.push(rec.clientId);
    labels.push(meta.clientLabel);
    const result = outcome(rec.clientId);
    // The real uploader records the outcome against the recording before it
    // returns. A stub that skipped that would leave a "sent" recording looking
    // pending, and the next sweep would send it again — which is precisely the
    // duplicate this module exists to avoid, hidden by an unfaithful double.
    await updateRecording(userId, rec.clientId, {
      status: result.ok ? 'uploaded' : 'failed',
      attempts: rec.attempts + 1,
    });
    return result;
  };
  return { calls, labels, send };
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  __resetAutoSend();
  clock = 0;
});

test('a named recording is sent', async () => {
  await add('a');
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  const result = await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['a']);
  assert.equal(result.sent, 1);
  assert.equal(result.skipped, false);
});

test('an UNNAMED recording IS sent on its own — this is the reversal', async () => {
  /*
    THIS TEST USED TO ASSERT THE OPPOSITE, and the comment above it read: "Naming is consent.
    Without it the app would be uploading a conversation the rep has not decided to keep."

    The reasoning was sound and the outcome was not. Consent was already given - the rep pressed
    record - and what the rule actually produced was a queue nobody could see: fifteen recordings
    on the founder's phone on 10 September 2026, 13.5 MB, with the Send-all button offering three.
    The other twelve were unnamed, and no screen anywhere said that was why they were stuck. It
    also made the app break a promise it makes out loud, in the alert after saving a door pitch:
    "It is on this phone and sends itself when you have signal."

    Reversed at the founder's instruction (REV 1): "After every pitch, they need to title it ...
    This should happen automatically."
  */
  await add('a', { label: null });
  const { calls, labels, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  const result = await runAutoSend('rep-1', { send });

  assert.equal(calls.length, 1, 'it goes');
  assert.equal(result.sent, 1);
  // And it goes under a name made of what is known, never an empty one — an empty name would put
  // it straight back into the queue this change exists to drain.
  assert.ok(labels[0].trim().length > 0);
});

test('a blank name is still no name, and still sends', async () => {
  // Whitespace was never a name. What changed is that it is no longer a reason to hold a
  // conversation on a phone for ever.
  await add('a', { label: '   ' });
  const { calls, labels, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));
  await runAutoSend('rep-1', { send });
  assert.equal(calls.length, 1);
  assert.ok(labels[0].trim().length > 0, 'and not under a blank name');
});

test('an already-sent recording is left alone', async () => {
  await add('a');
  await updateRecording('rep-1', 'a', { status: 'uploaded' });
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));
  await runAutoSend('rep-1', { send });
  assert.deepEqual(calls, []);
});

test('the oldest recording goes first', async () => {
  // The one most likely to have been forgotten.
  await addRecording('rep-1', {
    clientId: 'older',
    fileUri: 'file:///docs/older.m4a',
    sizeBytes: 1000,
    durationMs: 1000,
    mimeType: 'audio/m4a',
    recordedAt: '2026-09-01T08:00:00.000Z',
    label: 'First door',
  });
  await addRecording('rep-1', {
    clientId: 'newer',
    fileUri: 'file:///docs/newer.m4a',
    sizeBytes: 1000,
    durationMs: 1000,
    mimeType: 'audio/m4a',
    recordedAt: '2026-09-02T08:00:00.000Z',
    label: 'Second door',
  });
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['older', 'newer']);
});

test('a second sweep inside the cooldown does nothing', async () => {
  await add('a');
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  await runAutoSend('rep-1', { send });
  await add('b');
  const second = await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['a'], 'the second sweep did not upload');
  assert.equal(second.reason, 'cooldown');
});

test('force overrides the cooldown, for a deliberate retry', async () => {
  await add('a');
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  await runAutoSend('rep-1', { send });
  await add('b');
  await runAutoSend('rep-1', { force: true, send });

  assert.deepEqual(calls, ['a', 'b']);
});

test('a recording that has failed too often is left for the rep', async () => {
  await add('a');
  await updateRecording('rep-1', 'a', { attempts: 4, status: 'failed' });
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, [], 'automatic retries stopped');
  // But it is still there, and still sendable by hand.
  assert.equal((await listRecordings('rep-1')).length, 1);
});

test('a 401 stops the whole sweep instead of burning every recording attempt', async () => {
  // Every other recording would hit the same wall. Failing each one in turn
  // would spend four attempts each on a problem only a deployment can fix.
  await add('a');
  await add('b');
  const { calls, send } = stubUpload(() => ({
    ok: false,
    reason: 'needs-shim',
    message: 'not switched on yet',
  }));

  const result = await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['a'], 'it stopped after the first refusal');
  assert.equal(result.attempted, 1);
  assert.equal(autoSendStopped(), true);
});

test('once stopped, later sweeps do not even try', async () => {
  await add('a');
  const refusing = stubUpload(() => ({
    ok: false,
    reason: 'needs-shim',
    message: 'not switched on yet',
  }));
  await runAutoSend('rep-1', { send: refusing.send });

  // A sender that WOULD succeed. It must never be reached.
  // A sender that WOULD succeed, and force set. Neither reaches the queue:
  // force skips the cooldown, never the refusal.
  const willing = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));
  const result = await runAutoSend('rep-1', { force: true, send: willing.send });
  const calls = willing.calls;

  assert.deepEqual(calls, []);
  assert.equal(result.reason, 'stopped');
});

test('a successful manual send lets automatic sending resume', async () => {
  await add('a');
  const refusing = stubUpload(() => ({
    ok: false,
    reason: 'needs-shim',
    message: 'not switched on yet',
  }));
  await runAutoSend('rep-1', { send: refusing.send });
  assert.equal(autoSendStopped(), true);

  clearAutoSendStop();
  assert.equal(autoSendStopped(), false);

  const willing = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));
  await runAutoSend('rep-1', { force: true, send: willing.send });
  const calls = willing.calls;
  assert.deepEqual(calls, ['a']);
});

test('a too-large recording is skipped but the next one is still tried', async () => {
  // Permanent for that file, and says nothing about the others.
  await add('a');
  await add('b');
  const { calls, send } = stubUpload((id) =>
    id === 'a'
      ? { ok: false, reason: 'too-large', message: 'too big' }
      : { ok: true, sessionId: 'sess-1' },
  );

  const result = await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(result.sent, 1);
});

test('a plain failure ends the sweep rather than pushing through a dead connection', async () => {
  await add('a');
  await add('b');
  const { calls, send } = stubUpload(() => ({ ok: false, reason: 'failed', message: 'no signal' }));

  await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['a']);
  // Not a permanent stop — the next sweep will try again.
  assert.equal(autoSendStopped(), false);
});

test('nothing to send is reported as a skip, not as work done', async () => {
  const { send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));
  const result = await runAutoSend('rep-1', { send });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'nothing-to-send');
  assert.equal(result.sent, 0);
});

/* ── the shared rule ───────────────────────────────────────────────────── */

test('isSendable is the same rule a "send all" button must count by', async () => {
  // Exported precisely so a screen cannot grow a second copy of this condition.
  // The two would drift, and the first sign would be a button offering to send
  // three recordings and sending none.
  await add('named');
  await add('unnamed', { label: null });
  await add('sent');
  await updateRecording('rep-1', 'sent', { status: 'uploaded' });
  await add('exhausted');
  await updateRecording('rep-1', 'exhausted', { attempts: 4, status: 'failed' });

  const rows = await listRecordings('rep-1');
  const sendable = rows.filter(isSendable).map((r) => r.clientId);

  // Sorted: which of the two comes back first is the store's business, not this rule's, and
  // asserting it would make this test fail for a reason it is not about.
  assert.deepEqual(
    [...sendable].sort(),
    ['named', 'unnamed'],
    'unsent and still-retryable — the NAME is no longer part of this rule',
  );
});

test('what isSendable counts is exactly what a sweep attempts', async () => {
  // The guarantee that matters: the count a screen shows and the work the sender
  // does come from one rule.
  await add('named');
  await add('unnamed', { label: null });
  await add('exhausted');
  await updateRecording('rep-1', 'exhausted', { attempts: 4 });

  const expected = (await listRecordings('rep-1')).filter(isSendable).length;
  const { calls, send } = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));

  const result = await runAutoSend('rep-1', { send });

  assert.equal(calls.length, expected);
  assert.equal(result.attempted, expected);
});

test('giving up is exactly the inverse of being retried, for an unsent call', async () => {
  // The screen says "no longer being retried" from one of these and the sender
  // decides from the other. If they disagree, the app either nags about a
  // recording it is still handling or goes quiet about one it has abandoned.
  await add('fresh');
  await add('tired');
  await updateRecording('rep-1', 'tired', { attempts: MAX_AUTO_ATTEMPTS });

  const rows = await listRecordings('rep-1');
  for (const rec of rows) {
    if (rec.label?.trim()) {
      assert.equal(
        isSendable(rec),
        !autoSendGaveUp(rec),
        `${rec.clientId}: sendable and gave-up must be opposites`,
      );
    }
  }
});

test('a sent recording is never described as given up on', async () => {
  // It is finished, not abandoned — and telling a rep otherwise would send them
  // looking for a problem that does not exist.
  await add('done');
  await updateRecording('rep-1', 'done', { status: 'uploaded', attempts: 9 });
  const [row] = await listRecordings('rep-1');
  assert.equal(autoSendGaveUp(row), false);
});

test('one attempt short of the cap is still being retried', async () => {
  await add('nearly');
  await updateRecording('rep-1', 'nearly', { attempts: MAX_AUTO_ATTEMPTS - 1 });
  const [row] = await listRecordings('rep-1');
  assert.equal(autoSendGaveUp(row), false);
  assert.equal(isSendable(row), true);
});

// ------------------------------------------------------- concurrency

test('a second sweep while one is uploading does NOTHING', async () => {
  // The worst duplicate in the app: a recording is a real conversation, and
  // sending one twice creates two calls the rep has to reconcile. The stub
  // above deliberately marks each recording uploaded before returning — that
  // is what normally prevents a repeat — so this checks the OTHER guard, the
  // one that stops two sweeps overlapping at all. Removing it broke no test
  // until this one.
  await add('a');
  await add('b');

  let inFlight = 0;
  let maxInFlight = 0;
  let second: AutoSendResult | null = null;

  const inner = stubUpload(() => ({ ok: true, sessionId: 'sess-1' }));
  const send: Sender = async (userId, rec, meta) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    second = await runAutoSend('rep-1', { send });
    inFlight -= 1;
    return inner.send(userId, rec, meta);
  };

  const first = await runAutoSend('rep-1', { send });

  assert.equal(maxInFlight, 1, 'two sweeps uploaded at once');
  assert.equal(second !== null && (second as AutoSendResult).skipped, true);
  assert.equal(second !== null && (second as AutoSendResult).reason, 'already-running');
  assert.equal(first.sent, 2, 'the real sweep did not finish its queue');
});

test('the upload lock is released after a sweep, and after a throw', async () => {
  // A lock never released stops every recording on the phone from ever sending
  // again this session — the one failure worse than sending twice.
  await add('a');
  const boom: Sender = async () => {
    throw new Error('upload died mid-flight');
  };
  await runAutoSend('rep-1', { send: boom }).catch(() => undefined);

  const after = stubUpload(() => ({ ok: true, sessionId: 'sess-2' }));
  const result = await runAutoSend('rep-1', { send: after.send });
  assert.notEqual(result.reason, 'already-running', 'a thrown upload left the sweep locked');
});

test('a recording the server will refuse is not offered for sending', () => {
  // Without this it is re-selected by every sweep forever: the upload path
  // returns before counting an attempt, so it never ages out — and it is
  // counted in "Send all 3 now" when only two of the three can actually go.
  const base = {
    clientId: 'c1',
    fileUri: 'file:///a.m4a',
    recordedAt: '2026-09-03T10:00:00Z',
    durationMs: 60_000,
    label: 'Maple Street',
    attempts: 0,
    status: 'pending' as const,
  };
  assert.equal(isSendable({ ...base, sizeBytes: 2 * 1024 * 1024 } as PendingRecording), true);
  assert.equal(
    isSendable({ ...base, sizeBytes: 40 * 1024 * 1024 } as PendingRecording),
    false,
    'an oversize recording was still offered for sending',
  );
});

test('a recording whose size was never read is still offered', () => {
  // Not knowing is not a verdict — refusing to send on an unread figure would
  // strand a call that was fine.
  const base = {
    clientId: 'c2',
    fileUri: 'file:///b.m4a',
    recordedAt: '2026-09-03T10:00:00Z',
    durationMs: 60_000,
    label: 'Oak Road',
    attempts: 0,
    status: 'pending' as const,
  };
  assert.equal(isSendable({ ...base, sizeBytes: 0 } as PendingRecording), true);
});

test('a pitch that can never send does not stop the ones behind it', async () => {
  // 'not-ready' is a queued pitch with no outcome: the route requires one of
  // four values, so it fails identically every time. It must be skipped like
  // too-large — permanent for THIS recording — and must NOT halt the sweep the
  // way needs-shim does, or one unfinished pitch would freeze the whole queue.
  await add('a');
  await add('b');
  const { calls, send } = stubUpload((clientId) =>
    clientId === 'a'
      ? { ok: false, reason: 'not-ready', message: 'no outcome' }
      : { ok: true, sessionId: 'sess-b' },
  );

  const result = await runAutoSend('rep-1', { send });

  // BOTH were attempted: the first was skipped, the second still went.
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(result.sent, 1);
});

test('a plain failure DOES stop the sweep, unlike not-ready', async () => {
  // The contrast that gives the test above its meaning: a dead connection
  // stops the run, because pushing on just spends attempts.
  await add('a');
  await add('b');
  const { calls, send } = stubUpload((clientId) =>
    clientId === 'a'
      ? { ok: false, reason: 'failed', message: 'no signal' }
      : { ok: true, sessionId: 'sess-b' },
  );

  await runAutoSend('rep-1', { send });

  assert.deepEqual(calls, ['a'], 'the sweep carried on past a transient failure');
});
