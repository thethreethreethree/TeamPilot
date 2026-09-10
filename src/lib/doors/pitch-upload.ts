/**
 * Sending a recorded DOOR PITCH — the pipeline the app was missing.
 *
 * WHY THIS EXISTS, AND THE MISTAKE IT CORRECTS. On 3 September I found that a
 * rep in Macro Mode had no way to record at all, and added a "Record this pitch"
 * button to the Door Log. That part was right. Where it pointed was wrong: it
 * opened the COACHING-SESSION recorder, which creates a `coaching_sessions` row.
 * Your website has two pipelines, and recording from ITS Door Log posts
 * `kind: "pitch"` to the door-log route, which creates a knock AND a pitch — so
 * it counts as a door and appears in Pitch Performance. A session does neither.
 * A rep would have recorded a pitch and never found it where they looked.
 *
 * THE THREE STEPS, each verified against the route on `main`:
 *   1. POST /api/coach/sales-session/door-log { kind: "sign", mimeType }
 *        → { storagePath, token }
 *   2. PUT the bytes to Supabase Storage with that token, into `assets-v1`.
 *   3. POST /api/coach/sales-session/door-log
 *        { kind: "pitch", outcome, localDate, name, durationMs, clientKnockId,
 *          storagePath }
 *
 * STEP 2 BYPASSES THE API for the same reason the session upload does: a
 * serverless request body tops out around 4.5 MB and a recording is far larger.
 * The sign step exists precisely so the bytes never pass through the function.
 *
 * `clientKnockId` IS THE DE-DUPLICATION KEY and is sent for the same reason the
 * knock queue sends one: a retried pitch must be recognisably the same door, not
 * a second one. The route's own comment says it is idempotent on that value.
 */
import { File } from 'expo-file-system';

import { coachPost } from '@/lib/coach-api';
import { supabase } from '@/lib/supabase';
import type { PitchOutcome } from './pitch-outcome';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';

/** The bucket the door-log route signs into. Read from the web, not guessed. */
export const PITCH_BUCKET = 'assets-v1';

type SignResult = { storagePath: string; token: string };

/** Whole, non-negative milliseconds — the route's schema is `int().nonnegative()`. */
function wholeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms);
}

export type PitchSend =
  | { ok: true }
  /** The route refused the app's token — the app cannot fix this. */
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  /** Anything else. `message` is written for a rep, not a log. */
  | { ok: false; reason: 'failed'; message: string };

function classify(e: unknown, fallback: string): PitchSend {
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403 || status === 404) {
    return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
  }
  return { ok: false, reason: 'failed', message: fallback };
}

export async function sendPitch(input: {
  fileUri: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  outcome: PitchOutcome;
  /** YYYY-MM-DD in the REP's timezone — see knock-store's localDate. */
  localDate: string;
  /** What the rep called it. The route requires a non-empty name. */
  name: string;
  /** Stable across retries, so a resend is the same door. */
  clientKnockId: string;
}): Promise<PitchSend> {
  let signed: SignResult;
  try {
    signed = await coachPost<SignResult>('/api/coach/sales-session/door-log', {
      kind: 'sign',
      mimeType: input.mimeType,
    });
  } catch (e) {
    return classify(e, 'The upload could not be prepared. Your recording is still on this phone.');
  }
  if (!signed?.storagePath || !signed?.token) {
    return {
      ok: false,
      reason: 'failed',
      message: 'The upload could not be prepared. Your recording is still on this phone.',
    };
  }

  try {
    const bytes = await new File(input.fileUri).arrayBuffer();
    const { error } = await supabase.storage
      .from(PITCH_BUCKET)
      .uploadToSignedUrl(signed.storagePath, signed.token, bytes, {
        contentType: input.mimeType,
      });
    if (error) {
      return {
        ok: false,
        reason: 'failed',
        message: 'The audio did not finish uploading. Your recording is still on this phone.',
      };
    }
  } catch {
    return {
      ok: false,
      reason: 'failed',
      message: 'The audio did not finish uploading. Your recording is still on this phone.',
    };
  }

  try {
    await coachPost('/api/coach/sales-session/door-log', {
      kind: 'pitch',
      outcome: input.outcome,
      localDate: input.localDate,
      name: input.name,
      // The schema is `int().nonnegative()` and the figure comes from a native
      // recorder, so it is made whole here for the same reason the upload size
      // is — a fractional value is rejected outright, after the conversation.
      durationMs: input.durationMs === null ? null : wholeMs(input.durationMs),
      clientKnockId: input.clientKnockId,
      storagePath: signed.storagePath,
    });
    return { ok: true };
  } catch (e) {
    // The AUDIO is already in storage at this point. Saying "still on this
    // phone" would be true and unhelpful; what matters is that the outcome did
    // not register, so the door is not counted and the pitch will not appear.
    return classify(
      e,
      'The audio uploaded but the outcome did not save. Try sending it again.',
    );
  }
}
