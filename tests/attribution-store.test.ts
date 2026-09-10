/**
 * Regression tests for transcripts awaiting "which voice is you?".
 *
 * THE PAYLOAD HERE IS IRREPLACEABLE. The diarized speaker ids exist only in the
 * response to the upload that produced them — the server's stored transcript is
 * already flattened to agent/customer and cannot be asked again. Lose this and
 * the call can never be attributed, which means the session screen shows a wall
 * of unattributed speech for ever and the coach reasons about a conversation it
 * cannot tell apart.
 *
 * The second thing guarded is not asking a question that has no answer. One
 * voice means there is nothing to choose between, and a one-option picker is a
 * decision the app already made while pretending to offer one.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readPendingAttribution,
  writePendingAttribution,
  clearPendingAttribution,
  listPendingAttributions,
  clearAllPendingAttributions,
} from '@/lib/audio/attribution-store';

const speakers = [
  { speakerId: 'spk_0', sample: 'Morning — have you got two minutes?' },
  { speakerId: 'spk_1', sample: 'Depends what it is about.' },
];
const segments = [
  { speakerId: 'spk_0', text: 'Morning — have you got two minutes?', seq: 0 },
  { speakerId: 'spk_1', text: 'Depends what it is about.', seq: 1 },
];

const entry = (over: Record<string, unknown> = {}) => ({
  sessionId: 'sess-1',
  label: 'Rowan & Co',
  speakers,
  segments,
  ...over,
});

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

test('a diarized transcript is kept, whole', async () => {
  assert.equal(await writePendingAttribution(entry(), 'rep-1'), true);
  const got = await readPendingAttribution('rep-1', 'sess-1');
  assert.equal(got?.speakers.length, 2);
  assert.equal(got?.segments.length, 2, 'the segments the labelling route needs echoed back');
  assert.equal(got?.label, 'Rowan & Co');
});

test('ONE voice is still asked about, because the transcript depends on the answer', async () => {
  /*
   * THIS TEST USED TO ASSERT THE OPPOSITE, and asserting it is how the bug
   * shipped. The reasoning was "nothing to choose between; a one-option picker
   * is a decision already made" — true about the picker, and wrong about the
   * consequence: the transcript is only written when the rep answers, so
   * refusing to ask did not skip a prompt, it threw the whole transcript away.
   *
   * Measured on production 10 September 2026: 13 of 16 uploaded recordings had
   * audio, a stamped duration — so transcription ran — and no transcript at all.
   * The founder recorded a two-minute test, opened Ask the coach, and was told
   * the thread came through empty.
   *
   * With one voice the question is not "which of these is you" but "is this you
   * or the customer", which the app genuinely cannot answer for itself.
   */
  const kept = await writePendingAttribution(
    entry({ speakers: [speakers[0]], segments: [segments[0]] }),
    'rep-1',
  );
  assert.equal(kept, true);
  const back = await readPendingAttribution('rep-1', 'sess-1');
  assert.ok(back, 'a single-voice call was dropped instead of asked about');
  assert.equal(back!.speakers.length, 1);
  assert.equal(back!.segments.length, 1);
});

test('a call with NO voices at all is still refused', async () => {
  // Nothing was captured, so there is no question to ask and nothing to save.
  assert.equal(
    await writePendingAttribution(entry({ speakers: [], segments: [segments[0]] }), 'rep-1'),
    false,
  );
});

test('a payload with no segments is refused', async () => {
  // The answer would be unsubmittable: the route requires them echoed back.
  assert.equal(await writePendingAttribution(entry({ segments: [] }), 'rep-1'), false);
});

test('the write reports failure rather than failing silently', async () => {
  // The caller still holds the payload at that moment and can ask immediately —
  // which is the only remaining chance. A swallowed false would waste it.
  const huge = Array.from({ length: 20_000 }, (_, i) => ({
    speakerId: i % 2 ? 'spk_1' : 'spk_0',
    text: 'x'.repeat(300),
    seq: i,
  }));
  assert.equal(await writePendingAttribution(entry({ segments: huge }), 'rep-1'), false);
  assert.equal(await readPendingAttribution('rep-1', 'sess-1'), null, 'and nothing partial was kept');
});

test('one rep never sees another rep pending transcript', async () => {
  await writePendingAttribution(entry(), 'rep-1');
  assert.equal(await readPendingAttribution('rep-2', 'sess-1'), null);
});

test('each session is asked about separately', async () => {
  await writePendingAttribution(entry({ sessionId: 'a' }), 'rep-1');
  await writePendingAttribution(entry({ sessionId: 'b' }), 'rep-1');
  assert.equal((await listPendingAttributions('rep-1')).length, 2);
});

test('answering one leaves the others waiting', async () => {
  await writePendingAttribution(entry({ sessionId: 'a' }), 'rep-1');
  await writePendingAttribution(entry({ sessionId: 'b' }), 'rep-1');
  await clearPendingAttribution('rep-1', 'a');
  assert.equal(await readPendingAttribution('rep-1', 'a'), null);
  assert.ok(await readPendingAttribution('rep-1', 'b'));
});

test('a very old prompt is dropped rather than asked for ever', async () => {
  await writePendingAttribution(entry(), 'rep-1');
  const key = 'attribution.v1.rep-1.sess-1';
  const stored = JSON.parse((await AsyncStorage.getItem(key)) as string);
  stored.at = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  await AsyncStorage.setItem(key, JSON.stringify(stored));

  assert.equal(await readPendingAttribution('rep-1', 'sess-1'), null);
  assert.equal(await AsyncStorage.getItem(key), null, 'and removed, not left behind');
});

test('a corrupt entry reads as absent rather than throwing', async () => {
  await AsyncStorage.setItem('attribution.v1.rep-1.sess-1', '{ truncated');
  assert.equal(await readPendingAttribution('rep-1', 'sess-1'), null);
});

test('one unreadable entry does not lose the readable ones', async () => {
  await writePendingAttribution(entry({ sessionId: 'good' }), 'rep-1');
  await AsyncStorage.setItem('attribution.v1.rep-1.bad', 'not json');
  const all = await listPendingAttributions('rep-1');
  assert.deepEqual(all.map((a) => a.sessionId), ['good']);
});

test('sign-out clears them — they hold customer speech', async () => {
  await writePendingAttribution(entry({ sessionId: 'a' }), 'rep-1');
  await writePendingAttribution(entry({ sessionId: 'b' }), 'rep-2');

  await clearAllPendingAttributions('rep-1');

  assert.equal(await readPendingAttribution('rep-1', 'a'), null);
  assert.ok(await readPendingAttribution('rep-2', 'b'), 'the other rep keeps theirs');
});

test('sign-out leaves the other on-device stores alone', async () => {
  await AsyncStorage.setItem('recordings.v1.rep-1', '[]');
  await AsyncStorage.setItem('sessions.v1.rep-1', '{"rows":[],"at":"now"}');
  await writePendingAttribution(entry(), 'rep-1');

  await clearAllPendingAttributions('rep-1');

  assert.equal(await AsyncStorage.getItem('recordings.v1.rep-1'), '[]');
  assert.equal(await AsyncStorage.getItem('sessions.v1.rep-1'), '{"rows":[],"at":"now"}');
});
