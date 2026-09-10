/**
 * Getting a recording from the phone to the server.
 *
 * WHERE THE SEQUENCE ACTUALLY LIVES: `upload-flow.ts`. This module is now the
 * wiring — it supplies the filesystem, the HTTP client and the store, and holds
 * the native imports that kept the sequence untestable. The four steps below are
 * summarised here because the dependency list only makes sense next to them.
 *
 * FOUR STEPS, IN THIS ORDER, AND EACH ONE VERIFIED AGAINST THE REAL ROUTES:
 *
 *   1. POST /api/coach/sales-session
 *        { context, clientLabel, territory?, approach?, offer? }  → the session
 *   2. POST /api/coach/sales-session/{id}/upload-recording/sign
 *        { filename, sizeBytes, mimeType? }  → { bucket, storagePath, token }
 *   3. PUT the bytes straight to Supabase Storage with that token.
 *   4. POST /api/coach/sales-session/{id}/upload-recording
 *        { storagePath }  → the server transcribes and diarizes it.
 *
 * WHY STEP 3 BYPASSES THE API. The serverless request body limit is about
 * 4.5 MB and a call recording is far larger; the sign step exists precisely so
 * the bytes never pass through the function. That is the backend's design, not
 * a workaround.
 *
 * WHERE IT CAN STOP, AND WHY THAT IS SURVIVABLE. Every step can fail on a bad
 * connection. The recording stays on the phone until step 4 returns, and the
 * session id is written down as soon as step 1 succeeds — so a retry resumes
 * rather than creating a second session for the same call. That matters: the
 * plan records that this backend has an append-only double-write class, and a
 * naive retry is exactly how a rep ends up with the same conversation twice.
 *
 * THE SHIM LANDED, and this used to say it had not. These routes resolve a
 * Bearer token: on 4 September `POST .../upload-recording/sign` answered 404
 * "Session not found" for a made-up session id, which is the route reading the
 * request and looking the session up — it authenticated the app perfectly well.
 *
 * The refusal state below is KEPT, because a refusal is still possible for real
 * reasons (a session that is not yours, one that no longer exists), and a rep
 * who has just recorded a customer needs to be told the file is safe whatever
 * the cause. What changed is that "retrying will not help yet" is no longer the
 * default reading of a failure.
 */
import { File } from 'expo-file-system';

import { coachPost } from '@/lib/coach-api';
import { runUpload } from './upload-flow';
import { supabase } from '@/lib/supabase';
import { deleteRecordingFile, recordingFileExists } from './capture';
import {
  removeRecording,
  updateRecording,
  type PendingRecording,
} from './recording-store';
import { writePendingAttribution } from './attribution-store';
import { enqueue } from '@/lib/sync/outbox';

export type UploadOutcome =
  /**
   * `sessionId` is null for a DOOR PITCH, which creates a pitch and a knock
   * rather than a coaching session. Callers that offer to open the result must
   * check it — there is nothing to open.
   */
  | { ok: true; sessionId: string | null }
  | {
      ok: false;
      /**
       * `not-ready` is permanent for THIS recording but says nothing about the
       * next, exactly like `too-large` — a queued pitch with no outcome can
       * never succeed, so retrying it only spends attempts. The sweep must
       * treat it the way it treats the other two.
       */
      reason: 'needs-shim' | 'too-large' | 'file-gone' | 'not-ready' | 'failed';
      message: string;
    };


/**
 * What the finalize step hands back after diarizing.
 *
 * Read defensively: the transcription may not have produced two distinguishable
 * voices, and a one-sided recording is a real outcome rather than an error.
 */

/** The server accepts these two; a phone recording at a door is in person. */
export type CallContext = 'in_person' | 'video';


/**
 * Send one recording. Safe to call again after any failure: each step is skipped
 * if its result was already recorded.
 */
/**
 * The outside world, named so a test can stand in for it.
 *
 * WHY THIS EXISTS, and it is the most important test in the app. This function
 * decides the moment a rep's ONLY copy of a customer conversation is deleted
 * from their phone. The ordering is the whole guarantee:
 *
 *     await post(.../upload-recording)   <- the server confirms it holds the file
 *     deleteFile(rec.fileUri)            <- and ONLY then does the phone let go
 *
 * That ordering had no test. `auto-send.test.ts` injects its own sender and
 * never runs this code, so moving the delete two lines up would have destroyed
 * every rep's recordings while all 1,073 tests still passed. The queue AROUND
 * this function is thoroughly guarded; the function that does the deleting was
 * not guarded at all.
 *
 * INJECTED RATHER THAN MOCKED, which is the pattern `auto-send.test.ts` already
 * uses and states its reasons for: this module imports expo-file-system,
 * supabase and the HTTP client, none of which can be loaded by a test runner
 * that strips types rather than compiling them. A rule that can only be
 * exercised through a native filesystem is a rule that will not be exercised.
 *
 * Every field defaults to the real implementation, so no caller changes and the
 * shipped behaviour is byte-for-byte what it was.
 */
export type UploadDeps = {
  post: typeof coachPost;
  fileExists: (uri: string) => boolean;
  deleteFile: (uri: string) => void;
  readBytes: (uri: string) => Promise<ArrayBuffer>;
  uploadToStorage: (
    bucket: string,
    storagePath: string,
    token: string,
    bytes: ArrayBuffer,
    contentType: string,
  ) => Promise<{ error: { message?: string } | null }>;
  update: typeof updateRecording;
  remove: typeof removeRecording;
  /** Queue a write for later. Heavy (AsyncStorage), so it comes in from here. */
  enqueue: typeof enqueue;
  /** Keep the diarized speakers, which exist only in the finalize response. */
  writeAttribution: typeof writePendingAttribution;
};

/** The real world. Kept beside the type so the two cannot drift apart. */
export const REAL_UPLOAD_DEPS: UploadDeps = {
  post: coachPost,
  fileExists: recordingFileExists,
  deleteFile: deleteRecordingFile,
  readBytes: (uri) => new File(uri).arrayBuffer(),
  uploadToStorage: (bucket, storagePath, token, bytes, contentType) =>
    supabase.storage.from(bucket).uploadToSignedUrl(storagePath, token, bytes, { contentType }),
  update: updateRecording,
  remove: removeRecording,
  enqueue,
  writeAttribution: writePendingAttribution,
};

/**
 * Send one recording, with the real world wired in.
 *
 * The sequence itself lives in `upload-flow.ts`, which imports nothing native
 * so it can actually be tested — see that file for why. This function exists to
 * supply the filesystem, the HTTP client and the store, and to be the import
 * every caller already had.
 */
export async function uploadRecording(
  userId: string,
  rec: PendingRecording,
  meta: { clientLabel: string; context?: CallContext },
  deps: UploadDeps = REAL_UPLOAD_DEPS,
): Promise<UploadOutcome> {
  return runUpload(userId, rec, meta, deps);
}
