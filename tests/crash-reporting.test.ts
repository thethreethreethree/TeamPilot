/**
 * A crash report is a message to a third party, sent from an app that handles
 * recorded customer conversations. These tests are about what must never be in
 * one.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  MAX_REPORTED_TEXT,
  isSensitive,
  reportingEnabled,
  scrub,
} from '@/lib/crash-reporting';

test('a signed recording URL is never reported', () => {
  // Holding one of these IS holding the audio of a real conversation. The app
  // already treats them as secrets and clears them on sign-out; a crash report
  // must not be the way one escapes.
  const url = 'https://x.supabase.co/storage/v1/object/sign/assets-v1/co/rec.m4a?token=abc';
  assert.equal(isSensitive(url), true);
  assert.equal(scrub(url), '[removed: could identify a conversation]');
});

test('tokens and authorization headers are never reported', () => {
  for (const v of [
    'Authorization: Bearer eyJhbGciOi',
    'refresh_token=abc123',
    'access_token in the URL',
    'apikey=zzz',
  ]) {
    assert.equal(isSensitive(v), true, v);
  }
});

test('long free text is dropped, because it is probably a transcript', () => {
  // The realistic leak: an error message that happens to carry what someone
  // said. The shape is kept so a developer knows something was there.
  const transcript = 'So what I told him about the price was '.repeat(20);
  const out = scrub(transcript);
  assert.match(out ?? '', /^\[trimmed \d+ chars\]$/);
  assert.ok(transcript.length > MAX_REPORTED_TEXT);
});

test('an ordinary short error message survives intact', () => {
  // Scrubbing everything would make the reports useless, which is its own
  // failure — nobody fixes a crash they cannot see.
  assert.equal(scrub('Network request failed'), 'Network request failed');
});

test('nothing is reported for an empty or missing value', () => {
  // Null rather than '' so a scrubbed field is visibly absent, not blank.
  assert.equal(scrub(''), null);
  assert.equal(scrub('   '), null);
  assert.equal(scrub(null), null);
  assert.equal(scrub(undefined), null);
});

test('with no DSN, reporting is OFF — not merely quiet', () => {
  // A build with nowhere to send crashes must not initialise a client at all.
  // This is the default state of any build made before someone decides where
  // its crashes should go.
  assert.equal(reportingEnabled(undefined), false);
  assert.equal(reportingEnabled(null), false);
  assert.equal(reportingEnabled(''), false);
  assert.equal(reportingEnabled('   '), false);
  assert.equal(reportingEnabled('https://abc@o1.ingest.sentry.io/1'), true);
});

test('any JWT is treated as a credential, not just the ones we know', () => {
  // Matching the SHAPE rather than a specific key keeps this right when the
  // keys change, and catches tokens this app has never heard of.
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(isSensitive(`failed with ${jwt}`), true);
  assert.equal(scrub(`failed with ${jwt}`), '[removed: could identify a conversation]');
});

test('ordinary words that merely look technical are not scrubbed', () => {
  // Over-scrubbing makes reports useless, which is its own failure.
  assert.equal(isSensitive('Unable to reach the coach service'), false);
  assert.equal(isSensitive('timeout after 30s'), false);
});

test('a storage URL is scrubbed on its PATH alone, with no token in it', () => {
  // The earlier test's URL also carried "token=", so the token rule caught it
  // and the storage-path rule was never actually exercised — the mutation check
  // found that. A signed path with the query already stripped is exactly what a
  // breadcrumb or a filename in an error would carry.
  const path = 'https://x.supabase.co/storage/v1/object/sign/assets-v1/co/rec.m4a';
  assert.equal(path.includes('token='), false, 'the fixture must not lean on the token rule');
  assert.equal(isSensitive(path), true);
});
