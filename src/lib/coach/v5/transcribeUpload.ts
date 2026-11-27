import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readCompanyKeyterms } from "@/lib/coach/remote/vocabulary";
import { appendTranscriptSegment } from "@/lib/data/salesCoach";
import { spokenAtFor } from "@/lib/coach/v5/segmentTiming";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { recordSessionFailure } from "@/lib/coach/remote/session/failures";
import type { SalesContext } from "@/lib/data/salesCoach";

/**
 * An uploaded recording's transcription (moved out of upload-recording/route.ts on 2026-11-27, unchanged, so the public
 * API's call upload — Engage plan E6 — runs the very same steps, not a copy): batch diarization with two speakers and
 * the company's vocabulary; a recording with no speech or a failed transcription recorded as its closed reason; the real
 * audio length stamped; and the words saved at once as `unknown` speakers with each line's voice id, so the rep's
 * answer ("which voice is me?") is a refinement, never a precondition (see saveUnattributedTranscript).
 */
export type UploadSegment = { speakerId: string; text: string; start?: number; end?: number };
export type TranscribeUploadResult = { ok: true; segments: UploadSegment[]; durationSeconds: number } | { ok: false; code: "TRANSCRIBE_TIMEOUT" | "AI_UNAVAILABLE" };

export async function transcribeUploadedAudio(args: {
  companyId: string;
  sessionId: string;
  context: SalesContext;
  startedAt: string | null | undefined;
  audio: Buffer;
  mimeType: string;
  logTag: string;
}): Promise<TranscribeUploadResult> {
  const admin = createAdminClient();
  let segments: UploadSegment[];
  let durationSeconds = 0;
  try {
    const t = await transcribeWithDiarization({
      audio: args.audio,
      mimeType: args.mimeType,
      numSpeakers: 2,
      meter: { engine: "stt_batch", companyId: args.companyId, sessionId: args.sessionId },
      // The company's vocabulary (0306, opt-in). Read with the service role scoped to this company; [] when unset.
      keyterms: await readCompanyKeyterms(admin, args.companyId),
    });
    segments = t.segments;
    durationSeconds = t.durationSeconds;
    // RSS Phase 1: a recording with no speech in it is a closed reason, not a silent empty session.
    if (t.segments.length === 0) {
      await recordSessionFailure({ sessionId: args.sessionId, companyId: args.companyId, context: args.context, reason: "NO_SPEECH" });
    }
  } catch (err) {
    console.error(`[${args.logTag}] processing failed:`, err);
    const code = transcribeFailureCode(err);
    await recordSessionFailure({ sessionId: args.sessionId, companyId: args.companyId, context: args.context, reason: code });
    return { ok: false, code };
  }
  // Stamp the REAL audio length (§3.5) so an uploaded recording shows its length, not the session wall-clock.
  // Best-effort, but logged: a silent failure here reverts every duration surface to the wall-clock.
  if (durationSeconds > 0) {
    const { error: durErr } = await admin
      .from("coaching_sessions")
      .update({ audio_duration_seconds: durationSeconds })
      .eq("id", args.sessionId)
      .eq("company_id", args.companyId);
    if (durErr) console.error(`[${args.logTag}] failed to stamp audio_duration_seconds session=${args.sessionId}: ${durErr.message}`);
  }
  await saveUnattributedTranscript(args.sessionId, args.startedAt, segments);
  return { ok: true, segments, durationSeconds };
}

/**
 * RSS Phase 1 (0275): which closed reason a failed transcription records. Only an explicit abort/timeout is
 * called a timeout; anything else is the speech service not answering. Never shown to the rep raw — the rep
 * still gets the existing "your audio is saved, try again" message.
 */
function transcribeFailureCode(err: unknown): "TRANSCRIBE_TIMEOUT" | "AI_UNAVAILABLE" {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  return name === "AbortError" || name === "TimeoutError" || /time(d)?\s?out/i.test(msg) ? "TRANSCRIBE_TIMEOUT" : "AI_UNAVAILABLE";
}

/**
 * Save the transcript the MOMENT it exists, before anyone is asked anything.
 *
 * THE FAILURE THIS ENDS. The transcript used to be written only when the rep
 * answered "which voice is you?" — so a recording whose diarizer found a single
 * voice was never asked about, and its transcript was never written at all. The
 * audio was stored, the real duration was stamped from the transcription's own
 * word timestamps, and then the words were dropped on the floor. Silently:
 * nothing failed, nothing said so, and the coach later reported the thread came
 * through empty.
 *
 * Measured on production 10 September 2026: of 16 uploaded recordings, 13 had
 * audio and NO transcript. The founder's requirement, in their words: "there
 * should be 0% why any recording that has valid audio (people speaking) should
 * not have any transcript".
 *
 * So the words land here, unconditionally, as `unknown` speakers. Attribution
 * becomes a REFINEMENT rather than a precondition: when the rep says which voice
 * is theirs, `label-transcript` replaces this transcript with a labelled one —
 * which its existing zero-agent-turns rule already permits, because nothing here
 * writes an 'agent' turn.
 *
 * ON THE SERVER, not in the app, and deliberately: it cannot then be skipped by
 * a client that crashes between uploading and posting, it works for every client
 * including the web, and this is the only place that already holds both the
 * segments and the session's start time.
 *
 * BEST-EFFORT BY DESIGN. A failure here must not fail the upload — the audio is
 * already safe and re-transcribing is possible — so it is logged and swallowed.
 * The alternative is telling a rep their recording failed when it did not.
 */
export async function saveUnattributedTranscript(
  sessionId: string,
  startedAt: string | null | undefined,
  segments: Array<{ speakerId: string; text: string; start?: number; end?: number }>,
): Promise<void> {
  try {
    for (const [i, seg] of segments.entries()) {
      await appendTranscriptSegment({
        sessionId,
        // UNKNOWN, never a guess. Which voice is the rep is exactly what nobody
        // has established yet, and inventing it would put a fabricated speaker
        // label under every coaching score that reads this transcript.
        speaker: "unknown",
        text: seg.text,
        seq: i,
        spokenAt: spokenAtFor(startedAt, seg.start),
        // When the line ended (0277, RSS Phase 2): the same base and the same honesty rule as spokenAt.
        endedAt: spokenAtFor(startedAt, seg.end),
        // Which voice (0270): the rep has not said yet, so keep who said what for when they do.
        speakerCluster: seg.speakerId,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[upload-recording] transcript save failed session=${sessionId}: ${
        e instanceof Error ? e.message : "unknown"
      }`
    );
  }
}

