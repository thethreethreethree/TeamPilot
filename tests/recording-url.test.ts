/**
 * Regression tests for turning a stored asset path into something playable.
 *
 * THE FAILURE MODE IS NOT A CRASH. It is a "Listen to this call" control that
 * appears and then does nothing, on a session whose recording is perfectly safe
 * on the server — which teaches a rep that their recordings are unreliable. So
 * what matters is that a path this code does not understand comes back as "no
 * playback" cleanly, rather than as a malformed request that fails later.
 *
 * `splitAssetPath` is the whole of the parsing and it is pure, so it can be
 * tested exhaustively. The signing itself needs a Supabase client and a network,
 * and is deliberately not faked here — a mock of `createSignedUrl` would only
 * assert that this file calls the function it obviously calls.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitAssetPath } from '@/lib/sync/recording-path';

test('the real shape the server stores is split correctly', () => {
  // Written by TeamPilot's upload route as `${ASSETS_BUCKET}/${storagePath}`.
  const parts = splitAssetPath('assets-v1/1f0c2a44-0000-4000-8000-000000000000/call.m4a');
  assert.deepEqual(parts, {
    bucket: 'assets-v1',
    path: '1f0c2a44-0000-4000-8000-000000000000/call.m4a',
  });
});

test('a deeply nested path keeps every segment after the bucket', () => {
  const parts = splitAssetPath('assets-v1/company/2026/09/call.m4a');
  assert.equal(parts?.bucket, 'assets-v1');
  // Splitting on the LAST slash instead of the first would silently drop the
  // folders and sign a path that does not exist.
  assert.equal(parts?.path, 'company/2026/09/call.m4a');
});

test('a full URL is refused rather than mangled into a bucket name', () => {
  // An older row, or a different upload path, could hold one of these. Treating
  // "https:" as a bucket would produce a confident request for nothing.
  for (const raw of [
    'https://example.supabase.co/storage/v1/object/sign/assets-v1/x.m4a',
    'http://example.com/x.m4a',
  ]) {
    assert.equal(splitAssetPath(raw), null, raw);
  }
});

test('nothing to play reads as null, never as an error', () => {
  for (const raw of [null, undefined, '', '   ']) {
    assert.equal(splitAssetPath(raw), null, String(raw));
  }
});

test('a path with no bucket, or no object, is refused', () => {
  for (const raw of ['assets-v1', 'assets-v1/', '/leading-slash.m4a', '/']) {
    assert.equal(splitAssetPath(raw), null, raw);
  }
});

test('surrounding whitespace does not break a real path', () => {
  const parts = splitAssetPath('  assets-v1/company/call.m4a  ');
  assert.equal(parts?.bucket, 'assets-v1');
  assert.equal(parts?.path, 'company/call.m4a');
});
