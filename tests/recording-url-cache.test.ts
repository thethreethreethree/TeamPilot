/**
 * Regression tests for the signed recording-link cache.
 *
 * A SIGNED URL IS A BEARER CREDENTIAL for the audio of a real conversation:
 * whoever holds it can play that call until it expires. Three properties matter,
 * and none of them was covered.
 *
 * THE MARGIN MUST BE HONOURED. Returning a link that is technically still valid
 * but expires in two seconds hands a rep a player that dies mid-sentence. The
 * margin exists so a link is discarded while there is still time to mint
 * another; comparing against `expiresAt` alone quietly removes it.
 *
 * IT MUST NOT SURVIVE SIGN-OUT. Reps share phones. A link left in memory is the
 * previous rep's conversation, playable by whoever picks the phone up next.
 *
 *   npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  clearSignedRecordingUrls,
  getSignedUrl,
  putSignedUrl,
} from '@/lib/sync/recording-url-cache';

const NOW = 1_760_000_000_000;
const MARGIN = 30_000;

beforeEach(() => {
  clearSignedRecordingUrls();
});

test('nothing cached returns null', () => {
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), null);
});

test('a link with plenty of life is returned', () => {
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + 10 * 60_000 });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), 'https://x/a');
});

test('an EXPIRED link is never returned', () => {
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW - 1 });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), null);
});

test('a link inside the margin is refused, though it has not expired', () => {
  // The case a plain `expiresAt > now` check gets wrong: this link is still
  // valid, and handing it over gives the rep a player that dies mid-sentence.
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + MARGIN - 1_000 });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), null);
});

test('a link exactly at the margin is refused', () => {
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + MARGIN });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), null);
});

test('a link one millisecond past the margin is allowed', () => {
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + MARGIN + 1 });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), 'https://x/a');
});

test('recordings are cached separately', () => {
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + 60_000 });
  putSignedUrl('rec-2', { url: 'https://x/b', expiresAt: NOW + 60_000 });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), 'https://x/a');
  assert.equal(getSignedUrl('rec-2', MARGIN, NOW), 'https://x/b');
});

test('a fresh link replaces a stale one for the same recording', () => {
  putSignedUrl('rec-1', { url: 'https://x/old', expiresAt: NOW - 1 });
  putSignedUrl('rec-1', { url: 'https://x/new', expiresAt: NOW + 60_000 });
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), 'https://x/new');
});

test('SIGNING OUT drops every link', () => {
  // Reps share phones. A link left here is the previous rep's conversation,
  // playable by whoever picks the phone up next.
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + 60 * 60_000 });
  putSignedUrl('rec-2', { url: 'https://x/b', expiresAt: NOW + 60 * 60_000 });
  clearSignedRecordingUrls();
  assert.equal(getSignedUrl('rec-1', MARGIN, NOW), null);
  assert.equal(getSignedUrl('rec-2', MARGIN, NOW), null);
});

test('the sign-out sweep clears it', async () => {
  const { sweepDeviceCopies } = await import('@/lib/sign-out-flow');
  putSignedUrl('rec-1', { url: 'https://x/a', expiresAt: NOW + 60 * 60_000 });
  await sweepDeviceCopies('rep-1');
  assert.equal(
    getSignedUrl('rec-1', MARGIN, NOW),
    null,
    'a signed link to a real conversation survived sign-out',
  );
});
