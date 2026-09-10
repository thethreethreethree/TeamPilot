/**
 * Which caught failures reach the crash log — and, far more importantly, which do not.
 *
 * This rule has two ways to fail and they pull in opposite directions. Record too little and the screen says
 * "nothing has been recorded" to a rep who has just watched four uploads fail. Record too much and twenty slots
 * fill with "the network was down" in one afternoon, and the entry that mattered is gone.
 *
 * The second is the easier mistake to make and the harder one to notice, because a log full of entries LOOKS like
 * a working log. So the noise tests below are the load-bearing ones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECORDED_REASONS,
  noteFor,
  shouldRecord,
  RECORDED_UPLOAD_REASONS,
  subjectOfKind,
  shouldRecordUpload,
  uploadNoteFor,
  whereFor,
} from '@/lib/crash-notable';
import { classify } from '@/lib/sync/outbox-classify';
import { type CrashEntry, addEntry, describeEntry, formatReport, makeEntry } from '@/lib/crash-log';

const AT = new Date('2026-09-04T09:12:00.000Z');

// ---------------------------------------------------------------------------
// The noise cases — a rep works in dead zones all day
// ---------------------------------------------------------------------------

test('a dropped connection is NEVER recorded — it is the normal condition of this job', () => {
  // No status at all: DNS failure, dead socket, a stairwell.
  assert.equal(shouldRecord(classify(undefined)), false);
  assert.equal(shouldRecord(classify(500)), false, 'a server blip is retried, not reported');
  assert.equal(shouldRecord(classify(429)), false, 'rate limiting resolves itself');
});

test('a conflict is NEVER recorded — the server already has it, which is the right outcome', () => {
  assert.equal(shouldRecord(classify(409)), false);
});

test('a success is never recorded, and asking is not an error', () => {
  assert.equal(shouldRecord({ ok: true }), false);
});

test('an afternoon in a dead zone leaves the log EMPTY, not full', () => {
  // The regression this whole rule exists to prevent: 200 failed sweeps in one
  // afternoon, every slot consumed, and the real defect pushed out.
  let recorded = 0;
  for (let i = 0; i < 200; i += 1) if (shouldRecord(classify(undefined))) recorded += 1;
  assert.equal(recorded, 0);
});

// ---------------------------------------------------------------------------
// The cases that must survive
// ---------------------------------------------------------------------------

test('a server that refuses the write entirely is ALWAYS recorded — nobody else ever finds out', () => {
  for (const status of [401, 403, 404]) {
    assert.equal(shouldRecord(classify(status)), true, `${status} was dropped`);
  }
});

test('a rejection is ALWAYS recorded — the server considered it and said no', () => {
  for (const status of [400, 422]) {
    assert.equal(shouldRecord(classify(status)), true, `${status} was dropped`);
  }
});

test('the recorded set is exactly the two reasons a retry cannot cure', () => {
  // Pinned as a SET so that adding a third reason to the list is a deliberate
  // act with a failing test in front of it, not a one-word edit.
  assert.deepEqual([...RECORDED_REASONS], ['needs-shim', 'rejected']);
});

// ---------------------------------------------------------------------------
// What the entry says
// ---------------------------------------------------------------------------

test('a needs-shim note names what is CERTAIN, and does not guess at a deploy', () => {
  /**
   * This assertion used to require the words "needs a deploy, not a retry" —
   * pinning a cause that stopped being true. All five routes these writes use
   * take a Bearer token now, so a refusal is more likely an expired session, an
   * account without a company, or a missing row.
   *
   * The sentence goes into a PROBLEM REPORT, so a wrong cause sends whoever
   * reads it looking in the wrong place.
   */
  const note = noteFor(classify(403), 'how a call went');
  assert.match(note, /would not accept how a call went/);
  assert.match(note, /went on refusing/);
  assert.match(note, /Retrying will not help/);
  assert.ok(!/deploy/i.test(note), 'the note guesses at a deploy again');
});

test("the server's own words are carried through when it gave any", () => {
  assert.match(noteFor(classify(400, 'name is required'), 'a knock'), /It said: name is required/);
  assert.ok(!/It said/.test(noteFor(classify(400), 'a knock')), 'invented an empty quotation');
});

test('the subject is in the rep’s language, never the schema’s', () => {
  assert.equal(subjectOfKind('outcome'), 'how a call went');
  assert.equal(subjectOfKind('rename'), 'the name on a call');
  // "rename" would send whoever debugs it looking for a rename feature.
  assert.ok(!subjectOfKind('rename').includes('rename'));
  assert.equal(whereFor(subjectOfKind('outcome')), 'Sending how a call went');
});

test('noteFor refuses a success rather than inventing a failure sentence', () => {
  assert.throws(() => noteFor({ ok: true }, 'a knock'));
});

// ---------------------------------------------------------------------------
// Repeats — the other half of keeping the log readable
// ---------------------------------------------------------------------------

test('the same failure every sweep is ONE row, counted — not twenty rows', () => {
  let list: CrashEntry[] = [];
  for (let i = 0; i < 30; i += 1) {
    list = addEntry(list, makeEntry(new Error('server said no'), 'Sending a knock', AT, `id-${i}`));
  }
  assert.equal(list.length, 1, 'a repeating failure consumed more than one slot');
  assert.equal(list[0].repeats, 30);
});

test('a repeat does not push an earlier, different failure out of the log', () => {
  // This is the actual harm the collapse prevents: the rare entry surviving.
  let list = addEntry([], makeEntry(new Error('the rare one'), 'Recording', AT, 'rare'));
  for (let i = 0; i < 50; i += 1) {
    list = addEntry(list, makeEntry(new Error('server said no'), 'Sending a knock', AT, `id-${i}`));
  }
  assert.equal(list.length, 2);
  assert.ok(list.some((e) => e.message === 'the rare one'), 'the rare failure was pushed out');
});

test('two DIFFERENT failures alternating stay two rows — both are real facts', () => {
  let list: CrashEntry[] = [];
  for (let i = 0; i < 4; i += 1) {
    list = addEntry(list, makeEntry(new Error('A'), 'Sending a knock', AT, `a${i}`));
    list = addEntry(list, makeEntry(new Error('B'), 'Sending a knock', AT, `b${i}`));
  }
  assert.equal(list.length, 8, 'alternating failures were wrongly collapsed');
});

test('a count is shown to the rep and in the report, and a single occurrence says nothing', () => {
  const once = makeEntry(new Error('x'), 'Recording', AT, 'id');
  assert.ok(!describeEntry(once, () => 'now').title.includes('times'));

  const twice = addEntry([once], makeEntry(new Error('x'), 'Recording', AT, 'id2'))[0];
  assert.match(describeEntry(twice, () => 'now').title, /2 times/);
  assert.match(formatReport([twice], ctx()), /\(2 times/);
});

test('an entry written before repeats existed still reads back', () => {
  // Storage from an earlier version has no `repeats` field. Rejecting it would
  // wipe a rep's log on upgrade, at the exact moment they wanted to send it.
  const old: CrashEntry = { id: 'i', at: AT.toISOString(), where: 'w', message: 'm', frames: null };
  assert.ok(!describeEntry(old, () => 'now').title.includes('times'));
  assert.doesNotThrow(() => formatReport([old], ctx()));
});

function ctx() {
  return { appVersion: '1.0.0', platform: 'ios', osVersion: '18.0', userId: 'user-1' };
}

// ---------------------------------------------------------------------------
// Recordings — where the stakes are different, so the rule is different
// ---------------------------------------------------------------------------

test('a lost recording is ALWAYS recorded — it is the only copy of a real conversation', () => {
  assert.equal(shouldRecordUpload('file-gone'), true);
  const note = uploadNoteFor('file-gone', 'Mrs Patel, 14 Oak Road');
  assert.match(note, /cannot be recovered/);
  assert.match(note, /Mrs Patel/, 'the report does not say WHICH call was lost');
});

test('a server refusing uploads, and a call over the size limit, both survive', () => {
  assert.equal(shouldRecordUpload('needs-shim'), true);
  assert.equal(shouldRecordUpload('too-large'), true);
  assert.match(uploadNoteFor('needs-shim', 'x'), /Retrying will not help/);
  assert.ok(!/deploy/i.test(uploadNoteFor('needs-shim', 'x')), 'the upload note guesses at a deploy');
  assert.match(uploadNoteFor('too-large', 'x'), /can never be sent/);
});

test('an ordinary upload failure and an unfinished pitch are NEVER recorded', () => {
  // 'failed' is the dead zone, every sweep, all day. 'not-ready' is the rep's
  // own to finish — a queued pitch they have not given an outcome yet.
  assert.equal(shouldRecordUpload('failed'), false);
  assert.equal(shouldRecordUpload('not-ready'), false);
});

test('the recorded upload set is exactly the three that can never succeed', () => {
  assert.deepEqual([...RECORDED_UPLOAD_REASONS], ['needs-shim', 'file-gone', 'too-large']);
});

test('an unnamed recording still produces a readable sentence', () => {
  for (const label of [null, '', '   ']) {
    const note = uploadNoteFor('file-gone', label);
    assert.match(note, /an unnamed call/);
    assert.ok(!note.includes('null'), 'a null label leaked into the report');
  }
});

test('uploadNoteFor never throws — it runs inside a background sweep', () => {
  // A crash recorder that throws takes down the sweep it was recording.
  assert.doesNotThrow(() => uploadNoteFor('not-ready', 'x'));
});
