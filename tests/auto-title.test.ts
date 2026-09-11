/**
 * A recording could not leave the phone until someone typed a name for it.
 *
 * The rule was one line in `isSendable` — "No name means the rep has not said to send it yet" —
 * and the intent was consent. What it produced was a queue. The founder's phone on 10 September
 * 2026 held FIFTEEN recordings, 13.5 MB, with the Send-all button offering three: the other twelve
 * had no name, so they could never go, and no screen said that was the reason. Every one is a real
 * conversation with a customer that no coaching engine has ever seen.
 *
 * It also broke a promise the app makes out loud. Saving a door pitch alerts: "It is on this phone
 * and sends itself when you have signal." For an unnamed pitch that was false.
 *
 * So the load-bearing tests here are that a nameless recording now HAS a name, that the name is
 * never empty, and that the app never invents who the call was with.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UNTITLED, autoTitle, filedAs, isAutoTitled } from '@/lib/audio/auto-title';
import { isSendable } from '@/lib/audio/auto-send';
import type { PendingRecording } from '@/lib/audio/recording-store';

const AT = '2026-09-10T16:53:00.000Z';

function rec(over: Partial<PendingRecording> = {}): PendingRecording {
  return {
    clientId: 'c1',
    fileUri: 'file:///r.m4a',
    sizeBytes: 1_000_000,
    durationMs: 6_000,
    mimeType: 'audio/m4a',
    recordedAt: AT,
    label: null,
    sessionId: null,
    territory: null,
    approach: null,
    offer: null,
    outcome: null,
    dealValue: null,
    status: 'pending',
    lastError: null,
    attempts: 0,
    ...over,
  } as PendingRecording;
}

// ---------------------------------------------------------------------------
// The queue

test('an unnamed recording is sendable — this is the twelve', () => {
  assert.equal(isSendable(rec({ label: null })), true);
  assert.equal(isSendable(rec({ label: '   ' })), true, 'whitespace is not a name, and no longer a gate');
});

test('the rules that SHOULD still stop a recording are untouched', () => {
  assert.equal(isSendable(rec({ status: 'uploaded' })), false, 'already sent');
  assert.equal(isSendable(rec({ attempts: 99 })), false, 'given up on');
  assert.equal(isSendable(rec({ sizeBytes: 5_000_000_000 })), false, 'past the server ceiling');
});

// ---------------------------------------------------------------------------
// The name itself

test('a name is produced, and it is never empty', () => {
  const name = autoTitle({ recordedAt: AT, kind: 'pitch' });
  assert.ok(name.trim().length > 0);
  // An empty name would put the recording straight back in the queue this exists to drain.
  assert.notEqual(name.trim(), '');
});

test('it says which pipeline it came from, because a rep looks for one or the other', () => {
  assert.match(autoTitle({ recordedAt: AT, kind: 'pitch' }), /^Door,/);
  assert.match(autoTitle({ recordedAt: AT, kind: 'session' }), /^Call,/);
  // Absent means session — every recording made before `kind` existed is one.
  assert.match(autoTitle({ recordedAt: AT }), /^Call,/);
});

test('it never invents who the call was with', () => {
  const name = autoTitle({ recordedAt: AT, kind: 'pitch' });
  // The field asks "Who was this with?" and this cannot know. A plausible company name conjured
  // from a transcript would be a confident answer where there is no knowledge.
  assert.doesNotMatch(name, /Rowan|Co\.|customer|prospect/i);
});

test('an unusable timestamp falls back rather than producing half a name', () => {
  // "Door, at " reads as a bug, which is what a rep would report it as.
  assert.equal(autoTitle({ recordedAt: 'not a date', kind: 'pitch' }), UNTITLED);
  assert.equal(autoTitle({ recordedAt: null }), UNTITLED);
  assert.equal(autoTitle({ recordedAt: undefined }), UNTITLED);
  assert.ok(UNTITLED.trim().length > 0, 'the fallback must never be empty either');
});

// ---------------------------------------------------------------------------
// One rule, so the screen and the sender cannot disagree

test('a typed name always wins', () => {
  assert.equal(filedAs(rec({ label: 'Rowan & Co, the corner unit' })), 'Rowan & Co, the corner unit');
  assert.equal(filedAs({ label: '  Mrs Patel  ', recordedAt: AT, kind: 'pitch' }), 'Mrs Patel');
});

test('and a blank one falls through to the automatic name', () => {
  assert.equal(filedAs(rec({ label: null })), autoTitle({ recordedAt: AT, kind: 'session' }));
  assert.equal(filedAs(rec({ label: '   ' })), autoTitle({ recordedAt: AT, kind: 'session' }));
});

test('the screen and the sender ask the same question', () => {
  // `isAutoTitled` is what decides whether the card explains the name; `filedAs` is what the sender
  // uses. They must agree, or the rep is told one name and another is sent.
  const unnamed = rec({ label: null });
  assert.equal(isAutoTitled(unnamed), true);
  assert.equal(filedAs(unnamed), autoTitle(unnamed));

  const named = rec({ label: 'Mrs Patel' });
  assert.equal(isAutoTitled(named), false);
  assert.equal(filedAs(named), 'Mrs Patel');
});
