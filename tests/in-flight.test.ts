/**
 * Regression tests for recovering a call that never got to stop.
 *
 * THE FAILURE THIS GUARDS AGAINST IS SILENT AND TOTAL. The app is killed
 * mid-conversation, and on the next launch there is no error, no empty state and
 * no trace: the recording simply never existed. So the cases that matter are the
 * ones where the app must SAY something — the audio was saved, the audio is
 * gone, or it will try again — and the one where it must not: a clean stop leaves
 * nothing to announce.
 *
 * The filesystem is the stub in tests/stubs/expo-file-system.mjs, so this runs
 * under plain Node without a device.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system';
import { File, Paths } from 'expo-file-system';
import {
  markRecordingStarted,
  clearRecordingStarted,
  readMarker,
  recoverInterruptedRecording,
} from '@/lib/audio/in-flight';
import { listRecordings, storeKeyFor } from '@/lib/audio/recording-store';

const REP = 'rep-1';
const SOURCE = new File(Paths.cache, 'call-in-progress.m4a').uri;

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
  (FS as unknown as { __reset(): void }).__reset();
});

/** Put a recorder file where the marker says it is, with real bytes in it. */
function writeSource(bytes = 'x'.repeat(2048)): void {
  new File(SOURCE).write(bytes);
}

const start = (over: Partial<Parameters<typeof markRecordingStarted>[0]> = {}) =>
  markRecordingStarted({
    uri: SOURCE,
    startedAt: '2026-09-03T10:00:00.000Z',
    userId: REP,
    label: null,
    ...over,
  });

test('a clean stop leaves nothing to recover', async () => {
  await start();
  await clearRecordingStarted();

  assert.equal(await readMarker(), null);
  const result = await recoverInterruptedRecording(REP);
  // Nothing to announce. Every launch after a normal call must be silent.
  assert.equal(result.kind, 'none');
});

test('a launch with no marker at all is silent', async () => {
  assert.equal((await recoverInterruptedRecording(REP)).kind, 'none');
});

test('an interrupted call with its audio still there is recovered', async () => {
  await start();
  writeSource();

  const result = await recoverInterruptedRecording(REP);
  assert.equal(result.kind, 'recovered');

  const rows = await listRecordings(storeKeyFor(REP));
  assert.equal(rows.length, 1);
  assert.ok(rows[0].sizeBytes > 0, 'the size is read from the file, not assumed');
});

test('a recovered call claims no duration it does not have', async () => {
  await start();
  writeSource();

  await recoverInterruptedRecording(REP);
  const [row] = await listRecordings(storeKeyFor(REP));
  // The app was not running when the call ended. Deriving a length from the
  // start time would be a fabricated fact about a real conversation.
  assert.equal(row.durationMs, 0);
});

test('the marker is cleared once the audio is safe', async () => {
  await start();
  writeSource();

  await recoverInterruptedRecording(REP);
  // Otherwise the same call would be recovered again at every launch, producing
  // a duplicate each time.
  assert.equal(await readMarker(), null);
});

test('an interrupted call whose audio the phone reclaimed is reported LOST', async () => {
  await start(); // no file written: the OS cleared the cache

  const result = await recoverInterruptedRecording(REP);
  assert.equal(result.kind, 'lost');
  assert.equal(result.kind === 'lost' && result.startedAt, '2026-09-03T10:00:00.000Z');
  assert.equal((await listRecordings(storeKeyFor(REP))).length, 0);
  // Cleared: a marker that survived a confirmed loss would report the same dead
  // call at every launch from now on.
  assert.equal(await readMarker(), null);
});

test('a zero-byte file DEFERS the first time it is seen, and is not written off', async () => {
  /*
   * `File.size` returns 0 both for a file that is empty and for one that cannot
   * be READ. This used to be treated as one answer - lost - which cleared the
   * marker and destroyed the only pointer to audio that might still be on the
   * disk, with no later launch retrying because the marker was gone.
   *
   * The realistic trigger is not exotic: iOS cannot stat a protected file while
   * the phone is locked, and being killed mid-call with the phone in a pocket is
   * exactly the case recovery exists for.
   */
  await start();
  new File(SOURCE).write('');

  const result = await recoverInterruptedRecording(REP);
  assert.equal(result.kind, 'deferred');
  // The marker SURVIVES, which is the whole point - it is what makes the retry
  // possible at all.
  const marker = await readMarker();
  assert.ok(marker, 'the marker was cleared, so nothing can ever retry');
  assert.ok(marker!.zeroSeenAt, 'the sighting was not written down');
  assert.equal((await listRecordings(storeKeyFor(REP))).length, 0);
});

test('a zero-byte file seen TWICE really is empty, and is called lost', async () => {
  // One extra launch of patience, not indefinite deferral: a genuinely empty
  // file must eventually be reported so the rep can re-record while they still
  // remember the conversation.
  await start();
  new File(SOURCE).write('');

  assert.equal((await recoverInterruptedRecording(REP)).kind, 'deferred');
  const second = await recoverInterruptedRecording(REP);
  assert.equal(second.kind, 'lost');
  assert.equal(await readMarker(), null, 'a confirmed loss must clear the marker');
  assert.equal((await listRecordings(storeKeyFor(REP))).length, 0);
});

test('a file that appears between the two launches is recovered, not lost', async () => {
  // The case the old code could not reach: the first look could not read the
  // file, the second can, and the call is saved instead of written off.
  await start();
  new File(SOURCE).write('');
  assert.equal((await recoverInterruptedRecording(REP)).kind, 'deferred');

  writeSource();
  const second = await recoverInterruptedRecording(REP);
  assert.equal(second.kind, 'recovered');
  assert.equal((await listRecordings(storeKeyFor(REP))).length, 1);
});

test('a call recorded while signed out is recovered unattached', async () => {
  await start({ userId: null });
  writeSource();

  const result = await recoverInterruptedRecording(null);
  assert.equal(result.kind, 'recovered');
  // The unclaimed bucket, picked up by claimUnclaimedRecordings at the next
  // sign-in — the path this app already uses for a session that expired
  // mid-conversation.
  assert.equal((await listRecordings(storeKeyFor(null))).length, 1);
  assert.equal((await listRecordings(storeKeyFor(REP))).length, 0);
});

test('the name typed before recording survives the interruption', async () => {
  await start({ label: 'Rowan & Co' });
  writeSource();

  await recoverInterruptedRecording(REP);
  const [row] = await listRecordings(storeKeyFor(REP));
  // Auto-send only touches a named recording, so losing the name would leave a
  // recovered call sitting on the phone forever.
  assert.equal(row.label, 'Rowan & Co');
});

test('a corrupt marker is treated as no marker', async () => {
  await AsyncStorage.setItem('recording.inflight.v1', '{not json');
  assert.equal(await readMarker(), null);
  assert.equal((await recoverInterruptedRecording(REP)).kind, 'none');
});

test('a marker missing its uri is treated as no marker', async () => {
  await AsyncStorage.setItem(
    'recording.inflight.v1',
    JSON.stringify({ startedAt: '2026-09-03T10:00:00.000Z' }),
  );
  assert.equal(await readMarker(), null);
});
