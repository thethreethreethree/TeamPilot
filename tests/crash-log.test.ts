/**
 * The crash log, and the one thing about it that is not a matter of taste.
 *
 * This app records customer conversations. A problem report is a message a rep
 * sends OUT of the phone — into a mail client, a chat app, whatever the share
 * sheet offers — so it is a disclosure in exactly the way a crash sent to a
 * third-party service is. The tests that matter here are the ones that pin what
 * may travel in it, and they are written so that loosening the rule breaks a
 * named test rather than quietly widening what leaves a rep's phone.
 *
 * The rest pin the properties a log needs to have on the day it is used: it is
 * read on a screen somebody opened BECAUSE something is already broken, so a
 * corrupt log must read as empty, an odd thrown value must not throw again, and
 * nothing here may assume the error was an `Error`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_LOG_BODY,
  MAX_FRAMES,
  MAX_KEPT,
  type CrashEntry,
  addEntry,
  describeEntry,
  formatReport,
  makeEntry,
  parseEntries,
  versionLine,
} from '@/lib/crash-log';

const AT = new Date('2026-09-04T09:12:00.000Z');

/** A real Supabase signed-object URL shape. Holding one is holding the recording. */
const SIGNED = 'https://x.supabase.co/storage/v1/object/sign/recordings/abc.m4a?token=xyz';
/** A JWT, which is what an access token looks like whatever it is called. */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghij';

// ---------------------------------------------------------------------------
// What may leave the phone
// ---------------------------------------------------------------------------

test('a signed recording URL in an error message never reaches the entry', () => {
  const entry = makeEntry(new Error(`upload failed for ${SIGNED}`), 'upload', AT, 'id');
  assert.ok(!entry.message.includes('object/sign'), 'the signed URL survived into the entry');
  assert.ok(!entry.message.includes('token='), 'the token survived into the entry');
});

test('a JWT in a stack frame is removed frame by frame, not just checked on the message', () => {
  // The message is clean here on purpose: a scrubber that only looks at the
  // message passes this test's setup and fails its assertion.
  const error = new Error('render failed');
  error.stack = `Error: render failed\n    at load (bundle.js?apikey=${JWT}:1:1)\n    at run (app.js:2:2)`;
  const entry = makeEntry(error, 'boundary', AT, 'id');
  assert.ok(entry.frames, 'frames were dropped entirely');
  assert.ok(!entry.frames.join('\n').includes(JWT), 'a JWT survived in a stack frame');
  assert.ok(
    entry.frames.some((f) => f.includes('app.js')),
    'the innocent frame was thrown away with the guilty one',
  );
});

test('a thrown object is DESCRIBED, never serialized — a rejected response body would carry a transcript', () => {
  const entry = makeEntry({ body: 'customer said we already have solar' }, 'api', AT, 'id');
  assert.ok(!entry.message.includes('solar'), 'the thrown object was serialized into the report');
  assert.match(entry.message, /object was thrown/);
});

test('a long error message keeps its shape and loses its content', () => {
  const entry = makeEntry(new Error('x'.repeat(5000)), 'somewhere', AT, 'id');
  assert.ok(entry.message.length < 100, 'a 5000-character message was kept whole');
  assert.match(entry.message, /trimmed/);
});

test('the note a rep types is scrubbed too — the report is not a hole in the rules', () => {
  // The likeliest real case: a rep pastes the link they were looking at.
  const report = formatReport([], context(), `it broke on ${SIGNED}`);
  assert.ok(!report.includes('object/sign'), 'a pasted recording URL went out in the report');
});

test('the report states plainly that it carries no conversation, and only when there is something to carry', () => {
  const withEntries = formatReport([entryOf('boundary')], context());
  assert.match(withEntries, /No transcript, recording or customer detail/);
});

// ---------------------------------------------------------------------------
// Properties the log needs on the day it is used
// ---------------------------------------------------------------------------

test('a string throw is handled — plenty of code throws strings', () => {
  const entry = makeEntry('network down', 'sync', AT, 'id');
  assert.equal(entry.message, 'network down');
  assert.equal(entry.frames, null);
});

test('an Error with no message still says something a human can act on', () => {
  const entry = makeEntry(new TypeError(''), 'somewhere', AT, 'id');
  assert.equal(entry.message, 'TypeError');
});

test('newest first, and capped — the entry a rep just watched happen is the top row', () => {
  let list: CrashEntry[] = [];
  for (let i = 0; i < MAX_KEPT + 5; i += 1) list = addEntry(list, entryOf(`where-${i}`));
  assert.equal(list.length, MAX_KEPT, 'the cap did not hold');
  assert.equal(list[0].where, `where-${MAX_KEPT + 4}`, 'the newest entry is not first');
  assert.ok(!list.some((e) => e.where === 'where-0'), 'the oldest entry was not dropped');
});

test('frames are capped, so one runaway stack cannot fill the phone', () => {
  const error = new Error('deep');
  error.stack = ['Error: deep', ...Array.from({ length: 200 }, (_, i) => `    at f${i} (a.js:1:1)`)].join('\n');
  const entry = makeEntry(error, 'deep', AT, 'id');
  assert.equal(entry.frames?.length, MAX_FRAMES);
});

test('a corrupt log reads as empty rather than throwing on a screen opened because things are broken', () => {
  for (const raw of [null, undefined, '', 'not json', '{"not":"an array"}', '[1,2,3]']) {
    assert.deepEqual(parseEntries(raw), [], `threw or returned junk for ${JSON.stringify(raw)}`);
  }
});

test('a half-written entry is dropped, and the good ones beside it survive', () => {
  const good = entryOf('good');
  const raw = JSON.stringify([{ id: 'x' }, good, { at: 1 }]);
  assert.deepEqual(parseEntries(raw), [good]);
});

test('a stored log longer than the cap is still capped when read back', () => {
  const raw = JSON.stringify(Array.from({ length: MAX_KEPT + 10 }, (_, i) => entryOf(`w${i}`)));
  assert.equal(parseEntries(raw).length, MAX_KEPT);
});

// ---------------------------------------------------------------------------
// What a person reads
// ---------------------------------------------------------------------------

test('an empty log does NOT claim nothing went wrong', () => {
  // "No crashes" would be good news dressed over a fresh install, a cleared log,
  // or a failure that took the process down before anything could be written.
  const report = formatReport([], context());
  assert.match(report, /did not record any failure/);
  assert.ok(!/no problems|working fine|all good/i.test(report), 'the empty report reassures falsely');
  assert.ok(!/no problems|working fine|all good/i.test(EMPTY_LOG_BODY), 'the empty screen reassures falsely');
});

test('the report carries the version and the account, because a report nobody can place is not a report', () => {
  const report = formatReport([entryOf('boundary')], context());
  assert.match(report, /App version: 1\.0\.0/);
  assert.match(report, /Account: user-1/);
  assert.match(report, /Recorded failures: 1/);
});

test('a signed-out rep can still send one, and it says so rather than showing a blank', () => {
  const report = formatReport([], { ...context(), userId: null });
  assert.match(report, /Account: not signed in/);
});

test('a row leads with WHERE and WHEN, which is what a rep can match to what they were doing', () => {
  const { title, detail } = describeEntry(entryOf('Sessions'), () => '4 September, 09:12');
  assert.equal(title, 'Sessions · 4 September, 09:12');
  assert.equal(detail, 'it broke');
});

function entryOf(where: string): CrashEntry {
  return { id: `id-${where}`, at: AT.toISOString(), where, message: 'it broke', frames: null };
}

function context() {
  return { appVersion: '1.0.0', platform: 'ios', osVersion: '18.0', userId: 'user-1' };
}

// ---------------------------------------------------------------------------
// Which build a report came from
// ---------------------------------------------------------------------------

test('a report names the build, not just the marketing version', () => {
  // 1.0.0 is identical on every TestFlight build. Without the build number a
  // report from build 3 and one from build 7 read the same, and "which build?"
  // is the first question anyone asks about a bug.
  assert.equal(versionLine('1.0.0', '3'), '1.0.0 (3)');
  assert.equal(versionLine('1.0.0', '7'), '1.0.0 (7)');
  assert.notEqual(versionLine('1.0.0', '3'), versionLine('1.0.0', '7'));
});

test('either half missing still produces something a person can act on', () => {
  assert.equal(versionLine('1.0.0', null), '1.0.0');
  assert.equal(versionLine(null, '3'), 'build 3');
  assert.equal(versionLine(null, null), 'unknown');
  assert.equal(versionLine('  ', '  '), 'unknown');
});

// ---------------------------------------------------------------------------
// The connection check travels with the report
// ---------------------------------------------------------------------------

test('a connection result the rep ran is IN the report they send', () => {
  // The check ends with "Send this screen — the number is what somebody needs",
  // and the Send button sits right under it. Leaving the result out meant the one
  // line worth reading never left the phone.
  const report = formatReport([], context(), null, [
    'Signed in on this phone: yes.',
    'The coach service answered and REFUSED this account (401).',
  ]);
  assert.match(report, /Connection check:/);
  assert.match(report, /REFUSED this account \(401\)/);
});

test('a report with no check run does not grow an empty heading', () => {
  const report = formatReport([], context(), null, null);
  assert.ok(!/Connection check:/.test(report), 'an empty heading was added');
  assert.ok(!/Connection check:/.test(formatReport([], context(), null, [])));
});

test('the check lines are scrubbed like everything else that leaves the phone', () => {
  const report = formatReport([], context(), null, [`reached ${SIGNED}`]);
  assert.ok(!report.includes('object/sign'), 'a signed URL rode out in the check lines');
});
