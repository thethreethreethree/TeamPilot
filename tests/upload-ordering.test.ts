/**
 * The one property that stands between a rep and a lost customer conversation.
 *
 * `uploadRecording` decides the moment the phone deletes the ONLY copy of a
 * recorded call. The guarantee is an ordering:
 *
 *     await post(.../upload-recording)   the server confirms it holds the file
 *     deleteFile(rec.fileUri)            and ONLY then does the phone let go
 *
 * Until now nothing tested it. `auto-send.test.ts` injects its own sender and
 * never runs this function, so moving the delete above the confirm would have
 * destroyed every rep's recordings with all 1,073 other tests still passing.
 * The queue AROUND this function is thoroughly guarded — the 401 halt, the
 * cooldown, the retry cap, the concurrency lock — and the function that does the
 * deleting had no guard at all.
 *
 * The founder's stated biggest pain point is dropped sessions. This is the file
 * that defends against them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runUpload } from '@/lib/audio/upload-flow';
import type { UploadDeps } from '@/lib/audio/upload';

const REC = {
  clientId: 'rec-1',
  fileUri: 'file:///calls/rec-1.m4a',
  sizeBytes: 1024,
  mimeType: 'audio/m4a',
  createdAt: new Date('2026-09-04T09:00:00Z').toISOString(),
  status: 'pending',
  attempts: 0,
} as unknown as Parameters<typeof runUpload>[1];

/** Records the order things happened in, which is the whole subject here. */
function harness(overrides: Partial<UploadDeps> = {}) {
  const order: string[] = [];
  const deps: UploadDeps = {
    fileExists: () => {
      order.push('fileExists');
      return true;
    },
    readBytes: async () => {
      order.push('readBytes');
      return new ArrayBuffer(8);
    },
    uploadToStorage: async () => {
      order.push('uploadToStorage');
      return { error: null };
    },
    post: (async (path: string) => {
      order.push(`post:${path.split('/').pop()}`);
      if (path.endsWith('/sign')) {
        return { bucket: 'recordings', storagePath: 'co/rec-1.m4a', token: 'tok' };
      }
      if (path.endsWith('/upload-recording')) return { speakers: [], segments: [] };
      if (path.endsWith('/outcome')) return {};
      return { id: 'sess-1' };
    }) as UploadDeps['post'],
    update: (async () => {
      order.push('update');
    }) as UploadDeps['update'],
    remove: (async () => {
      order.push('remove');
    }) as UploadDeps['remove'],
    deleteFile: () => {
      order.push('deleteFile');
    },
    // Return real-shaped values, not void: the fakes must satisfy the same
    // contract the flow does, or the test proves less than it appears to.
    enqueue: (async () => {
      order.push('enqueue');
      return { id: 'q1' };
    }) as unknown as UploadDeps['enqueue'],
    writeAttribution: (async () => {
      order.push('writeAttribution');
      return true;
    }) as unknown as UploadDeps['writeAttribution'],
    ...overrides,
  };
  return { deps, order };
}

test('the file is deleted ONLY AFTER the server confirms it holds the recording', async () => {
  const { deps, order } = harness();
  const result = await runUpload('rep-1', REC, { clientLabel: 'Mrs Diaz' }, deps);

  assert.equal(result.ok, true, 'the happy path did not complete');
  const confirm = order.indexOf('post:upload-recording');
  const del = order.indexOf('deleteFile');
  assert.ok(confirm !== -1, 'the confirming request was never made');
  assert.ok(del !== -1, 'the local file was never cleaned up');
  assert.ok(
    confirm < del,
    `the phone deleted the only copy BEFORE the server confirmed it. Order was: ${order.join(' -> ')}`,
  );
});

test('a confirm that FAILS leaves the recording on the phone', async () => {
  // The case that matters at a door: the upload reaches Storage and the
  // confirming call dies on a flaky connection. The bytes may be in a bucket the
  // server does not yet know about, so the phone is still the only place this
  // call is reachable from — and it must keep it.
  const { deps, order } = harness({
    post: (async (path: string) => {
      order.push(`post:${path.split('/').pop()}`);
      if (path.endsWith('/sign')) {
        return { bucket: 'recordings', storagePath: 'co/rec-1.m4a', token: 'tok' };
      }
      if (path.endsWith('/upload-recording')) throw new Error('Network request failed');
      return { id: 'sess-1' };
    }) as UploadDeps['post'],
  });

  const result = await runUpload('rep-1', REC, { clientLabel: 'Mrs Diaz' }, deps);

  assert.equal(result.ok, false, 'a failed confirm was reported as success');
  assert.ok(
    !order.includes('deleteFile'),
    `the recording was deleted after a FAILED confirm. Order was: ${order.join(' -> ')}`,
  );
  assert.ok(!order.includes('remove'), 'the queue entry was dropped after a failed confirm');
});

test('a failure while sending the bytes also leaves the recording alone', async () => {
  const { deps, order } = harness({
    uploadToStorage: async () => {
      order.push('uploadToStorage');
      return { error: { message: 'The upload did not complete.' } };
    },
  });

  const result = await runUpload('rep-1', REC, { clientLabel: 'Mrs Diaz' }, deps);

  assert.equal(result.ok, false);
  assert.ok(!order.includes('deleteFile'), 'the only copy was deleted after a storage failure');
});

test('a recording whose file has already gone never reaches the network', async () => {
  // Creating an empty session on the server and then failing is worse than
  // saying plainly that the audio is not here any more.
  const { deps, order } = harness({ fileExists: () => false });
  const result = await runUpload('rep-1', REC, { clientLabel: 'Mrs Diaz' }, deps);

  assert.equal(result.ok, false);
  assert.equal((result as { reason: string }).reason, 'file-gone');
  assert.ok(!order.some((o) => o.startsWith('post:')), 'it called the server for a file that is gone');
});

test('an unnamed recording is refused before anything is touched', async () => {
  const { deps, order } = harness();
  const result = await runUpload('rep-1', REC, { clientLabel: '   ' }, deps);
  assert.equal(result.ok, false);
  assert.deepEqual(order, [], 'work was done for a recording that cannot be sent');
});
