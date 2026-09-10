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
import type { UploadOutcome } from '@/lib/audio/upload';
import type { PendingRecording } from '@/lib/audio/recording-store';
import { uploadBlockedMessage } from '@/lib/blocked-state';

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

  const result = await sendPitch({
    fileUri: rec.fileUri,
    mimeType: rec.mimeType,
    sizeBytes: rec.sizeBytes,
    durationMs: rec.durationMs,
    outcome: rec.pitchOutcome,
    localDate: rec.pitchLocalDate,
    // The route requires a non-empty name. The rep's own words when they gave
    // them; otherwise the day, which is true and readable, never a generated id.
    name: meta.clientLabel.trim() || `Door on ${rec.pitchLocalDate}`,
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
