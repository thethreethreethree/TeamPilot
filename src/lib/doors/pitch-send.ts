/**
 * Sending a queued door pitch, in the shape the auto-sender expects.
 *
 * THE ADAPTER BETWEEN TWO WORLDS. The recording queue speaks `UploadOutcome`
 * — ok, or a reason the sweep uses to decide whether to retry. The door-log
 * pipeline speaks its own result. This translates, and nothing else lives here.
 *
 * A PITCH WITH NO OUTCOME IS NOT SENDABLE, and that is a permanent refusal
 * rather than something to retry. The route requires one of four values; a
 * queued pitch missing it would fail identically forever, spending an attempt
 * each time. The recordings screen already says when something cannot be sent —
 * this gives it the true reason instead of a network error it would retry.
 */
import { sendPitch } from './pitch-upload';
import { isPitchOutcome } from './pitch-outcome';
import { autoTitle } from '@/lib/audio/auto-title';
import type { UploadOutcome } from '@/lib/audio/upload';
import type { PendingRecording } from '@/lib/audio/recording-store';
import { uploadBlockedMessage } from '@/lib/blocked-state';
import { checkRecordingIntegrity, integrityMessage } from '@/lib/audio/recording-integrity';

export async function sendPitchRecording(
  rec: PendingRecording,
  meta: { clientLabel: string },
): Promise<UploadOutcome> {
  if (!isPitchOutcome(rec.pitchOutcome)) {
    return {
      ok: false,
      reason: 'not-ready',
      message:
        'This pitch has no outcome recorded, so it cannot be sent. Open it and choose how it went.',
    };
  }
  if (!rec.pitchLocalDate) {
    return {
      ok: false,
      reason: 'not-ready',
      message: 'This pitch is missing the day it happened, so it cannot be sent.',
    };
  }

  /*
   * AN EMPTY FILE IS A PERMANENT REFUSAL, and telling the rep is the whole point.
   *
   * Measured on production 10 September 2026: 14 of 83 door pitches failed permanently, and
   * one was FIVE BYTES of Matroska container carrying `duration_ms = 129800` - a rep
   * recorded at a door for over two minutes and the phone handed back a file with no media
   * in it. It uploaded fine. The server took it. Five retries later the pipeline gave up and
   * wrote the reason into a row nobody reads.
   *
   * Uploading it again would spend an attempt to reach the identical answer, which is what
   * `not-ready` means here - the same permanent-refusal shape as a missing outcome, not a
   * network error the sweep should retry.
   */
  const integrity = checkRecordingIntegrity(rec.sizeBytes, rec.durationMs);
  if (!integrity.ok) {
    return { ok: false, reason: 'not-ready', message: integrityMessage(integrity.reason) };
  }

  const result = await sendPitch({
    fileUri: rec.fileUri,
    mimeType: rec.mimeType,
    sizeBytes: rec.sizeBytes,
    durationMs: rec.durationMs,
    outcome: rec.pitchOutcome,
    localDate: rec.pitchLocalDate,
    /*
      The route requires a non-empty name. The rep's own words when they gave them; otherwise the
      one automatic name this app has.

      IT USED TO BE `Door on ${rec.pitchLocalDate}` HERE, and that is worth a sentence rather than
      a silent deletion. This sender already knew how to name an unnamed pitch - it has since it
      was written - while `isSendable` upstream was refusing to hand it one at all. The gate was
      not protecting anything this code needed; it was stopping work that was ready.

      Now there is one rule instead of two. Two fallbacks for one situation is how a rep finds
      "Door on 2026-09-10" under Pitch Performance and "Door, Thu 10 Sep at 4:53 PM" on the phone,
      for the same call.
    */
    name: meta.clientLabel.trim() || autoTitle(rec),
    // The recording's own id doubles as the knock id: it is generated once and
    // never regenerated, which is exactly what the route de-duplicates on.
    clientKnockId: rec.clientId,
  });

  // No session id: a pitch is not a coaching session.
  if (result.ok) return { ok: true, sessionId: null };
  if (result.reason === 'needs-shim') {
    // Not "needs a change on the website that has not gone live yet", which is what this said until the door-log
    // route was actually checked rather than assumed. It accepts a phone token, so that sentence was promising a
    // deploy that had already happened — and telling a signed-out rep to wait instead of to sign in.
    return { ok: false, reason: 'needs-shim', message: uploadBlockedMessage(result.why) };
  }
  return { ok: false, reason: 'failed', message: result.message };
}
