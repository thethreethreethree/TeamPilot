/**
 * Regression tests for the offline copy of a session's detail.
 *
 * The two failures worth guarding are both silent:
 *
 *   - a cached transcript served without its age. Transcript and cues are
 *     append-only, so a stale copy is wrong by OMISSION — the rep sees no coach
 *     cues and concludes the coach said nothing, when four cues arrived after
 *     the copy was taken. The stored timestamp is what lets the screen say so.
 *   - one rep's transcripts surviving sign-out on a shared phone. These hold
 *     customer conversations, which makes the sweep the sharpest edge here.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import * as FS from 'expo-file-system';
import {
  readCachedDetail,
  writeCachedDetail,
  clearAllCachedDetails,
  cachedDetailBytes,
} from '@/lib/sync/session-detail-cache';
import type { CoachingCue, CoachingSession, TranscriptSegment } from '@/types/backend';

const SESSION = { id: 'sess-1', client_label: 'Rowan & Co' } as CoachingSession;
const SEGMENTS = [
  { id: 's1', seq: 1, speaker: 'customer', text: 'Too expensive.', spoken_at: null },
] as unknown as TranscriptSegment[];
const CUES = [
  { id: 'c1', text: 'Ask what they compare it to.', mode: 'suggestion', delivered_at: null },
] as unknown as CoachingCue[];

/** What is actually on "disk", for asserting a write happened or did not. */
const files = () => (FS as unknown as { __files(): Map<string, string> }).__files();

/** The one file a session's copy lives in. */
const pathFor = (userId: string, sessionId: string) =>
  `file:///documents/session-cache/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}.json`;

/** Age a stored copy rather than waiting out the real clock. */
function ageBy(userId: string, sessionId: string, ms: number) {
  const path = pathFor(userId, sessionId);
  const stored = JSON.parse(files().get(path) as string);
  stored.at = new Date(Date.now() - ms).toISOString();
  new FS.File(path).write(JSON.stringify(stored));
}

beforeEach(() => {
  (FS as unknown as { __reset(): void }).__reset();
});

test('a cached session comes back whole, with the time it was fetched', async () => {
  await writeCachedDetail('rep-1', 'sess-1', {
    session: SESSION,
    segments: SEGMENTS,
    cues: CUES,
  });
  const got = await readCachedDetail('rep-1', 'sess-1');
  assert.equal(got?.session.id, 'sess-1');
  assert.equal(got?.segments.length, 1);
  assert.equal(got?.cues.length, 1);
  assert.ok(got && !Number.isNaN(new Date(got.at).getTime()), 'the age is recorded and readable');
});

test('a session never cached reads as absent', async () => {
  assert.equal(await readCachedDetail('rep-1', 'sess-9'), null);
});

test('a session with no transcript yet is still cached', async () => {
  // Empty arrays are a real state — a recording that has not been transcribed.
  // Treating them as "nothing to cache" would send that rep to the network
  // every time for a screen that has an honest answer.
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: [], cues: [] });
  const got = await readCachedDetail('rep-1', 'sess-1');
  assert.equal(got?.session.id, 'sess-1');
  assert.deepEqual(got?.segments, []);
});

test('one rep cannot read another rep cached session', async () => {
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });
  assert.equal(await readCachedDetail('rep-2', 'sess-1'), null);
});

test('a copy older than a week is refused, and dropped from disk', async () => {
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });
  ageBy('rep-1', 'sess-1', 8 * 24 * 60 * 60 * 1000);

  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
  assert.equal(files().has(pathFor('rep-1', 'sess-1')), false, 'removed, not left behind');
});

test('a copy just under a week old still comes back', async () => {
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });
  ageBy('rep-1', 'sess-1', 6 * 24 * 60 * 60 * 1000);

  assert.equal((await readCachedDetail('rep-1', 'sess-1'))?.session.id, 'sess-1');
});

test('a corrupt entry reads as absent rather than throwing', async () => {
  new FS.Directory('file:///documents/session-cache/rep-1').create({ intermediates: true });
  new FS.File(pathFor('rep-1', 'sess-1')).write('{ truncated');
  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
});

test('an entry missing its session row is refused', async () => {
  // It would render a screen with a stale banner and no facts above it.
  new FS.Directory('file:///documents/session-cache/rep-1').create({ intermediates: true });
  new FS.File(pathFor('rep-1', 'sess-1')).write(
    JSON.stringify({ segments: [], cues: [], at: new Date().toISOString() }),
  );
  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
});

test('an entry whose arrays are not arrays is refused', async () => {
  new FS.Directory('file:///documents/session-cache/rep-1').create({ intermediates: true });
  new FS.File(pathFor('rep-1', 'sess-1')).write(
    JSON.stringify({ session: SESSION, segments: null, cues: null, at: new Date().toISOString() }),
  );
  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
});

test('sign-out sweeps every session this rep cached', async () => {
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });
  await writeCachedDetail('rep-1', 'sess-2', { session: SESSION, segments: [], cues: [] });

  await clearAllCachedDetails('rep-1');

  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
  assert.equal(await readCachedDetail('rep-1', 'sess-2'), null);
});

test('sign-out does not take the other rep transcripts on a shared phone', async () => {
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });
  await writeCachedDetail('rep-2', 'sess-1', { session: SESSION, segments: [], cues: [] });

  await clearAllCachedDetails('rep-1');

  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
  assert.ok(await readCachedDetail('rep-2', 'sess-1'), 'rep two keeps their own');
});

test('sign-out leaves other files on the device alone', async () => {
  // The sweep deletes ONE directory. A broader delete would take recordings
  // with it — and those are the only irreplaceable thing on the phone.
  new FS.Directory('file:///documents/recordings').create({ intermediates: true });
  new FS.File('file:///documents/recordings/rec_a.m4a').write('audio');
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });

  await clearAllCachedDetails('rep-1');

  assert.equal(files().get('file:///documents/recordings/rec_a.m4a'), 'audio');
});

test('re-fetching replaces the copy rather than accumulating', async () => {
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: [], cues: [] });
  await writeCachedDetail('rep-1', 'sess-1', { session: SESSION, segments: SEGMENTS, cues: CUES });
  assert.equal(files().size, 1);
  assert.equal((await readCachedDetail('rep-1', 'sess-1'))?.segments.length, 1);
});

/* ── a long call ──────────────────────────────────────────────────────── */

/** A two-hour appointment: thousands of segments, several megabytes of text. */
const hugeSegments = (): TranscriptSegment[] =>
  Array.from({ length: 4000 }, (_, i) => ({
    id: `s${i}`,
    seq: i,
    speaker: i % 2 ? 'agent' : 'customer',
    text: 'x'.repeat(300),
    spoken_at: null,
  })) as unknown as TranscriptSegment[];

test('a long call is cached WHOLE — it is the one most worth having offline', async () => {
  // This used to be refused. The old key-value store had a 1 MB ceiling, and it
  // landed on exactly the wrong sessions: the short calls cached and the long
  // difficult one a rep wanted to re-read on the way home did not.
  await writeCachedDetail('rep-1', 'sess-1', {
    session: SESSION,
    segments: hugeSegments(),
    cues: [],
  });

  const got = await readCachedDetail('rep-1', 'sess-1');
  assert.equal(got?.segments.length, 4000, 'every segment, not a truncated prefix');
  assert.equal(got?.segments[3999].text.length, 300, 'and the last one intact');
});

test('a long call is never stored partially', async () => {
  // The rule that survives the change: a transcript that ends mid-conversation
  // with nothing saying why is the silent truncation this app exists to avoid.
  // Removing the ceiling removes the REASON to truncate; it does not license it.
  await writeCachedDetail('rep-1', 'sess-1', {
    session: SESSION,
    segments: hugeSegments(),
    cues: [],
  });
  const stored = JSON.parse(files().get(pathFor('rep-1', 'sess-1')) as string);
  assert.equal(stored.segments.length, 4000);
});

test('a long call still expires like any other', async () => {
  await writeCachedDetail('rep-1', 'sess-1', {
    session: SESSION,
    segments: hugeSegments(),
    cues: [],
  });
  ageBy('rep-1', 'sess-1', 8 * 24 * 60 * 60 * 1000);
  assert.equal(await readCachedDetail('rep-1', 'sess-1'), null);
});

test('an ordinary session is still cached', async () => {
  const ordinary = Array.from({ length: 400 }, (_, i) => ({
    id: `s${i}`,
    seq: i,
    speaker: 'customer',
    text: 'A normal spoken line of maybe eighty characters, which is a long sentence.',
    spoken_at: null,
  })) as unknown as TranscriptSegment[];

  await writeCachedDetail('rep-1', 'sess-2', { session: SESSION, segments: ordinary, cues: [] });
  assert.equal((await readCachedDetail('rep-1', 'sess-2'))?.segments.length, 400);
});

/* ── how many are kept ─────────────────────────────────────────────────── */

/** Write a copy and set its age, so eviction order is checkable. */
async function cacheAged(sessionId: string, minutesAgo: number) {
  await writeCachedDetail('rep-1', sessionId, {
    session: SESSION,
    segments: SEGMENTS,
    cues: CUES,
  });
  ageBy('rep-1', sessionId, minutesAgo * 60 * 1000);
}

test('the newest fifty are kept and the rest evicted', async () => {
  // Removing the size ceiling means one copy can be megabytes. Without a bound
  // on COUNT the app would fill the phone and the first symptom would be the
  // recorder refusing to start — space spent on old transcripts instead of the
  // call being recorded now.
  for (let i = 0; i < 55; i++) {
    await cacheAged(`sess-${String(i).padStart(2, '0')}`, 55 - i);
  }
  assert.equal(files().size, 50, 'fifty kept');
});

test('the OLDEST go first — recency is the reason to keep one', async () => {
  for (let i = 0; i < 52; i++) {
    // sess-00 is the oldest, sess-51 the newest.
    await cacheAged(`sess-${String(i).padStart(2, '0')}`, 52 - i);
  }
  assert.equal(await readCachedDetail('rep-1', 'sess-00'), null, 'the oldest is gone');
  assert.equal(await readCachedDetail('rep-1', 'sess-01'), null);
  assert.ok(await readCachedDetail('rep-1', 'sess-51'), 'the newest survived');
});

test('eviction removes whole sessions, never part of one', async () => {
  // The rule that must survive the bound: a transcript is stored whole or not at
  // all. Losing a session costs an offline copy the rep can fetch again; losing
  // half of one leaves them reading a conversation that stops mid-sentence.
  for (let i = 0; i < 52; i++) {
    await cacheAged(`sess-${String(i).padStart(2, '0')}`, 52 - i);
  }
  for (const [, contents] of files()) {
    const parsed = JSON.parse(contents);
    assert.equal(parsed.segments.length, SEGMENTS.length, 'every surviving copy is intact');
  }
});

test('a corrupt copy is the first evicted', async () => {
  for (let i = 0; i < 50; i++) {
    await cacheAged(`sess-${String(i).padStart(2, '0')}`, 50 - i);
  }
  new FS.File(pathFor('rep-1', 'broken')).write('{ not json');
  // One more write tips it over the cap.
  await cacheAged('sess-new', 0);

  assert.equal(files().has(pathFor('rep-1', 'broken')), false, 'the unreadable one went first');
  assert.ok(await readCachedDetail('rep-1', 'sess-new'));
});

test('under the cap, nothing is evicted', async () => {
  for (let i = 0; i < 10; i++) {
    await cacheAged(`sess-${i}`, 10 - i);
  }
  assert.equal(files().size, 10);
});

test('eviction does not touch another rep copies', async () => {
  await writeCachedDetail('rep-2', 'theirs', { session: SESSION, segments: SEGMENTS, cues: CUES });
  for (let i = 0; i < 55; i++) {
    await cacheAged(`sess-${String(i).padStart(2, '0')}`, 55 - i);
  }
  assert.ok(await readCachedDetail('rep-2', 'theirs'), 'a different rep is unaffected');
});

/* ── how much room it is using ─────────────────────────────────────────── */

test('the cache reports its own size', async () => {
  // The recorder quotes this when it refuses to start. Without it, saved
  // transcripts are invisible and a rep is sent to delete the wrong things.
  await writeCachedDetail('rep-1', 'a', { session: SESSION, segments: SEGMENTS, cues: CUES });
  await writeCachedDetail('rep-1', 'b', { session: SESSION, segments: SEGMENTS, cues: CUES });
  assert.ok(cachedDetailBytes('rep-1') > 0);
});

test('an empty cache uses nothing', async () => {
  assert.equal(cachedDetailBytes('rep-1'), 0);
});

test('the size does not count another rep copies', async () => {
  // A rep freeing space would otherwise be quoted a figure they cannot act on.
  await writeCachedDetail('rep-2', 'theirs', { session: SESSION, segments: SEGMENTS, cues: CUES });
  assert.equal(cachedDetailBytes('rep-1'), 0);
});

test('clearing the cache frees what it reported', async () => {
  await writeCachedDetail('rep-1', 'a', { session: SESSION, segments: SEGMENTS, cues: CUES });
  assert.ok(cachedDetailBytes('rep-1') > 0);

  await clearAllCachedDetails('rep-1');

  assert.equal(cachedDetailBytes('rep-1'), 0);
});

test('clearing the cache does NOT touch recordings', async () => {
  // The distinction the whole warning rests on: a transcript downloads again, a
  // recording is the only copy of a conversation.
  new FS.Directory('file:///documents/recordings').create({ intermediates: true });
  new FS.File('file:///documents/recordings/rec_a.m4a').write('audio');
  await writeCachedDetail('rep-1', 'a', { session: SESSION, segments: SEGMENTS, cues: CUES });

  await clearAllCachedDetails('rep-1');

  assert.equal(files().get('file:///documents/recordings/rec_a.m4a'), 'audio');
});
