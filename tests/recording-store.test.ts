/**
 * Regression tests for the on-device record of unsent recordings.
 *
 * THIS STORE GUARDS THE ONLY IRREPLACEABLE DATA IN THE APP. A session, a
 * transcript, a KPI — all of them can be fetched again. A recording of a
 * conversation that happened at a door cannot. So the failures worth writing
 * tests for are not crashes; they are the quiet ones:
 *
 *   - an entry silently dropped, so a rep believes a call was sent when the
 *     phone has simply forgotten it exists.
 *   - a retry creating a SECOND entry for the same call, which downstream turns
 *     into two sessions for one conversation. The plan is explicit that this
 *     backend has an append-only double-write class, so the idempotency key is
 *     load-bearing, not decoration.
 *   - one rep seeing another's recordings on a shared phone.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addRecording,
  claimUnclaimedRecordings,
  countPending,
  countUnclaimed,
  listRecordings,
  pendingAtSignOut,
  pendingBytes,
  recordingKind,
  removeRecording,
  storeKeyFor,
  type PendingRecording,
  updateRecording,
  uploaderFor,
} from '@/lib/audio/recording-store';

/**
 * Only the fields a caller is allowed to supply. Typed narrowly on purpose: a
 * helper that accepts `status` or `attempts` would let a test construct a state
 * the real code can never produce, and then prove something about it.
 */
type NewRecording = Omit<
  PendingRecording,
  | 'status'
  | 'lastError'
  | 'attempts'
  | 'sessionId'
  | 'territory'
  | 'approach'
  | 'offer'
  | 'outcome'
  | 'dealValue'
> &
  Partial<
    Pick<
      PendingRecording,
      'sessionId' | 'label' | 'territory' | 'approach' | 'offer' | 'outcome' | 'dealValue'
    >
  >;

// Field by field rather than a spread: spreading a Partial over required fields
// widens them back to optional, and the cast that silences that would undo the
// narrowing this helper exists for.
const base = (over: Partial<NewRecording> = {}): NewRecording => ({
  clientId: over.clientId ?? 'rec_a',
  fileUri: over.fileUri ?? 'file:///docs/recordings/rec_a.m4a',
  sizeBytes: over.sizeBytes ?? 1_200_000,
  durationMs: over.durationMs ?? 300_000,
  mimeType: over.mimeType ?? 'audio/m4a',
  recordedAt: over.recordedAt ?? '2026-09-02T10:00:00.000Z',
  sessionId: over.sessionId ?? null,
  label: over.label ?? null,
  territory: over.territory ?? null,
  approach: over.approach ?? null,
  offer: over.offer ?? null,
  outcome: over.outcome ?? null,
  dealValue: over.dealValue ?? null,
});

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a recording is stored the moment it is added', async () => {
  const row = await addRecording('rep-1', base());
  assert.equal(row.status, 'pending');
  assert.equal(row.attempts, 0);
  assert.equal(row.sessionId, null);

  const all = await listRecordings('rep-1');
  assert.equal(all.length, 1);
  assert.equal(all[0].clientId, 'rec_a');
});

test('adding the same clientId twice replaces, never duplicates', async () => {
  // The double-write guard. A retried save must not turn one call into two.
  await addRecording('rep-1', base());
  await addRecording('rep-1', base({ sizeBytes: 999 }));
  const all = await listRecordings('rep-1');
  assert.equal(all.length, 1);
  assert.equal(all[0].sizeBytes, 999);
});

test('recordings come back newest first', async () => {
  await addRecording('rep-1', base({ clientId: 'old', recordedAt: '2026-09-01T09:00:00.000Z' }));
  await addRecording('rep-1', base({ clientId: 'new', recordedAt: '2026-09-02T09:00:00.000Z' }));
  assert.deepEqual((await listRecordings('rep-1')).map((r) => r.clientId), ['new', 'old']);
});

test('one rep never sees another rep recordings', async () => {
  await addRecording('rep-1', base());
  assert.deepEqual(await listRecordings('rep-2'), []);
});

test('the pending count excludes what has already been sent', async () => {
  await addRecording('rep-1', base({ clientId: 'a' }));
  await addRecording('rep-1', base({ clientId: 'b' }));
  await updateRecording('rep-1', 'a', { status: 'uploaded' });
  assert.equal(await countPending('rep-1'), 1);
});

test('a failed recording still counts as pending', async () => {
  // A failure must never look like a success. It is still the only copy.
  await addRecording('rep-1', base());
  await updateRecording('rep-1', 'rec_a', { status: 'failed', lastError: 'no signal' });
  assert.equal(await countPending('rep-1'), 1);
});

test('a session id, once assigned, is remembered', async () => {
  // The resume point. Without this a retry creates a second session for the
  // same conversation.
  await addRecording('rep-1', base());
  await updateRecording('rep-1', 'rec_a', { sessionId: 'sess-9', label: 'Rowan & Co' });
  const [row] = await listRecordings('rep-1');
  assert.equal(row.sessionId, 'sess-9');
  assert.equal(row.label, 'Rowan & Co');
});

test('updating one recording leaves the others untouched', async () => {
  await addRecording('rep-1', base({ clientId: 'a' }));
  await addRecording('rep-1', base({ clientId: 'b' }));
  await updateRecording('rep-1', 'a', { status: 'failed' });
  const rows = await listRecordings('rep-1');
  assert.equal(rows.find((r) => r.clientId === 'b')?.status, 'pending');
});

test('updating a recording that is not there changes nothing', async () => {
  await addRecording('rep-1', base());
  await updateRecording('rep-1', 'not-here', { status: 'uploaded' });
  const rows = await listRecordings('rep-1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'pending');
});

test('removing takes only the one named', async () => {
  await addRecording('rep-1', base({ clientId: 'a' }));
  await addRecording('rep-1', base({ clientId: 'b' }));
  await removeRecording('rep-1', 'a');
  assert.deepEqual((await listRecordings('rep-1')).map((r) => r.clientId), ['b']);
});

test('sign-out reports what is unsent rather than deleting it', async () => {
  // The deliberate difference from every other store in this app: a pending
  // recording is not a stale copy, it is the original. It must survive.
  await addRecording('rep-1', base({ clientId: 'a' }));
  await addRecording('rep-1', base({ clientId: 'b' }));
  await updateRecording('rep-1', 'b', { status: 'uploaded' });

  const stranded = await pendingAtSignOut('rep-1');
  assert.deepEqual(stranded.map((r) => r.clientId), ['a']);

  // And it is still there afterwards.
  assert.equal((await listRecordings('rep-1')).length, 2);
});

test('a corrupt store reads as empty rather than throwing', async () => {
  await AsyncStorage.setItem('recordings.v1.rep-1', 'not json');
  assert.deepEqual(await listRecordings('rep-1'), []);
  assert.equal(await countPending('rep-1'), 0);
});

test('a malformed entry is skipped without losing the valid ones', async () => {
  await AsyncStorage.setItem(
    'recordings.v1.rep-1',
    JSON.stringify([{ nonsense: true }, { ...base(), status: 'pending', attempts: 0 }]),
  );
  const rows = await listRecordings('rep-1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clientId, 'rec_a');
});

test('a store holding an object instead of a list reads as empty', async () => {
  await AsyncStorage.setItem('recordings.v1.rep-1', JSON.stringify({ rec_a: base() }));
  assert.deepEqual(await listRecordings('rep-1'), []);
});

test('the call context survives the round trip', () => {
  // Where / how / what are what the website asks for and what the numbers read.
  // A recorded call that loses them is thinner than one typed up later — the
  // parity gap this field set exists to close.
  return (async () => {
    await addRecording('rep-1', base({ territory: 'Northside', approach: 'Cold knock' }));
    const [row] = await listRecordings('rep-1');
    assert.equal(row.territory, 'Northside');
    assert.equal(row.approach, 'Cold knock');
    assert.equal(row.offer, null, 'a field not given stays absent, not empty');
  })();
});

test('context can be added after the recording exists', async () => {
  // The real order of events: record at the door, add the detail in the van.
  await addRecording('rep-1', base());
  await updateRecording('rep-1', 'rec_a', { offer: 'Annual plan, install included' });
  const [row] = await listRecordings('rep-1');
  assert.equal(row.offer, 'Annual plan, install included');
  assert.equal(row.label, null, 'and it did not disturb the other fields');
});

test('clearing a context field stores null, not an empty string', async () => {
  // An empty string would file the session as having a blank territory rather
  // than none, which is a different claim.
  await addRecording('rep-1', base({ territory: 'Northside' }));
  await updateRecording('rep-1', 'rec_a', { territory: null });
  const [row] = await listRecordings('rep-1');
  assert.equal(row.territory, null);
});

test('the outcome survives the round trip', async () => {
  // Conversion rate is sold divided by opportunities. A recording that loses its
  // outcome is a call that never reaches the rep's own numbers.
  await addRecording('rep-1', base({ outcome: 'sold', dealValue: 1500 }));
  const [row] = await listRecordings('rep-1');
  assert.equal(row.outcome, 'sold');
  assert.equal(row.dealValue, 1500);
});

test('a deal value is stored in major units, matching the column', async () => {
  // numeric(14,2) is dollars, not cents. This app has already had one 100x bug
  // of exactly that shape, from two plan documents describing it wrongly.
  await addRecording('rep-1', base({ outcome: 'sold', dealValue: 1500 }));
  const [row] = await listRecordings('rep-1');
  assert.equal(row.dealValue, 1500, '1500 means $1,500.00, not $15.00');
});

test('an outcome can be set after the recording exists', async () => {
  await addRecording('rep-1', base());
  assert.equal((await listRecordings('rep-1'))[0].outcome, null);

  await updateRecording('rep-1', 'rec_a', { outcome: 'no_sale' });
  const [row] = await listRecordings('rep-1');
  assert.equal(row.outcome, 'no_sale');
  assert.equal(row.dealValue, null, 'and a no-sale carries no value');
});

test('a deal value can be cleared back to absent', async () => {
  await addRecording('rep-1', base({ outcome: 'sold', dealValue: 900 }));
  await updateRecording('rep-1', 'rec_a', { dealValue: null });
  assert.equal((await listRecordings('rep-1'))[0].dealValue, null);
});

test('a recording with no outcome is still sendable', async () => {
  // Optional means optional. A rep who does not know yet must not be blocked,
  // and the audio is the half that cannot be recreated.
  await addRecording('rep-1', base({ label: 'Rowan & Co' }));
  const [row] = await listRecordings('rep-1');
  assert.equal(row.outcome, null);
  assert.equal(row.label, 'Rowan & Co');
});

/* ── recordings made while signed out ──────────────────────────────────── */

test('a recording made signed out is saved, not refused', async () => {
  // A session can expire mid-conversation. Refusing to save at that moment
  // would destroy the one thing in this app that cannot be recreated.
  await addRecording(storeKeyFor(null), base({ recordedAt: new Date().toISOString() }));
  assert.equal(await countUnclaimed(), 1);
});

test('signing in claims a recording made moments earlier', async () => {
  await addRecording(storeKeyFor(null), base({ recordedAt: new Date().toISOString() }));

  const claimed = await claimUnclaimedRecordings('rep-1');

  assert.equal(claimed, 1);
  assert.equal((await listRecordings('rep-1')).length, 1);
  assert.equal(await countUnclaimed(), 0, 'and it is no longer unattached');
});

test('an old unattached recording is NOT handed to whoever signs in', async () => {
  // A phone left in a drawer for a week, then given to someone else, must not
  // hand them the previous person's conversation.
  const old = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
  await addRecording(storeKeyFor(null), base({ recordedAt: old }));

  const claimed = await claimUnclaimedRecordings('rep-1');

  assert.equal(claimed, 0);
  assert.deepEqual(await listRecordings('rep-1'), []);
  assert.equal(await countUnclaimed(), 1, 'but it is kept, not deleted — it is still a only copy');
});

test('an unreadable timestamp is never claimed on a guess', async () => {
  await addRecording(storeKeyFor(null), base({ recordedAt: 'whenever' }));
  assert.equal(await claimUnclaimedRecordings('rep-1'), 0);
  assert.equal(await countUnclaimed(), 1);
});

test('claiming twice does not duplicate', async () => {
  await addRecording(storeKeyFor(null), base({ recordedAt: new Date().toISOString() }));
  await claimUnclaimedRecordings('rep-1');
  await claimUnclaimedRecordings('rep-1');
  assert.equal((await listRecordings('rep-1')).length, 1);
});

test('claiming keeps the recordings the rep already had', async () => {
  await addRecording('rep-1', base({ clientId: 'mine' }));
  await addRecording(storeKeyFor(null), base({ clientId: 'new', recordedAt: new Date().toISOString() }));

  await claimUnclaimedRecordings('rep-1');

  const ids = (await listRecordings('rep-1')).map((r) => r.clientId).sort();
  assert.deepEqual(ids, ['mine', 'new']);
});

test('claiming when there is nothing unattached is a no-op', async () => {
  assert.equal(await claimUnclaimedRecordings('rep-1'), 0);
});

test('a corrupt unattached store does not break signing in', async () => {
  await AsyncStorage.setItem('recordings.v1.__unclaimed', 'not json');
  assert.equal(await claimUnclaimedRecordings('rep-1'), 0);
});

test('pendingBytes sums only what is still on the phone', async () => {
  // The recorder quotes this when it refuses to start. A total that counted
  // already-sent recordings would tell a rep to free space that is not there to
  // free, and they would go looking for it.
  await addRecording('rep-1', base({ clientId: 'a', sizeBytes: 1_000_000 }));
  await addRecording('rep-1', base({ clientId: 'b', sizeBytes: 2_000_000 }));
  await addRecording('rep-1', base({ clientId: 'sent', sizeBytes: 9_000_000 }));
  await updateRecording('rep-1', 'sent', { status: 'uploaded' });

  assert.equal(await pendingBytes('rep-1'), 3_000_000);
});

test('pendingBytes is zero when nothing is waiting', async () => {
  assert.equal(await pendingBytes('rep-1'), 0);
});

test('pendingBytes does not count another rep on a shared phone', async () => {
  await addRecording('rep-2', base({ sizeBytes: 5_000_000 }));
  assert.equal(await pendingBytes('rep-1'), 0);
});

test('a recording saved before the pipeline marker existed is a SESSION', () => {
  // THE upgrade case. Every recording made before `kind` existed is a session —
  // that is what all of them were. Reading `rec.kind` directly would make those
  // undefined and route them nowhere, and on this path "nowhere" is a rep's
  // unsent conversation.
  assert.equal(recordingKind({}), 'session');
  assert.equal(recordingKind({ kind: undefined }), 'session');
});

test('a pitch is a pitch, and anything else is a session', () => {
  assert.equal(recordingKind({ kind: 'pitch' }), 'pitch');
  assert.equal(recordingKind({ kind: 'session' }), 'session');
  // Defensive: a value from a corrupted store must not become a pitch by
  // accident — sending a session down the door-log path would create a knock
  // the rep never made.
  assert.equal(recordingKind({ kind: 'nonsense' as 'pitch' }), 'session');
});

test('a pitch is sent to the door log, a session to the session route', () => {
  // The decision the automatic sweep AND the hand-send button both make. The
  // senders themselves import native modules and cannot run here, so this is
  // the part that can be pinned — and choosing wrongly is the whole failure:
  // a pitch sent as a session never counts as a door and never appears in
  // Pitch Performance.
  assert.equal(uploaderFor({ kind: 'pitch' }), 'door-log');
  assert.equal(uploaderFor({ kind: 'session' }), 'coaching-session');
});

test('a recording from before the marker goes to the session route', () => {
  // The upgrade case again: sending one down the door-log path would create a
  // knock the rep never made.
  assert.equal(uploaderFor({}), 'coaching-session');
  assert.equal(uploaderFor({ kind: undefined }), 'coaching-session');
});
