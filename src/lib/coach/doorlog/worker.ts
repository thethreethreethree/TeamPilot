import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { transcribeSpeech } from "@/lib/care/voice/elevenlabs";
import { downloadAssetBytes } from "@/lib/storage/assets";
import { analyzePitch, ANALYSIS_PROMPT_VERSION } from "./analyze";
import {
  writePitchTranscript,
  writePitchAnalysis,
  setPitchStatus,
  claimPitchesToProcess,
  claimPitchForProcessing,
} from "@/lib/data/doorlog";
import { backoffMs, isTerminalFailure } from "./retryBackoff";
import { stitchPitchAudio, recordingIdFromAudioPath } from "./pitchAudioChunks";

/**
 * Pitch-processing worker (Macro Mode pipeline, build-spec 3.3). Nothing here is in the rep's request path:
 * a knock/pitch is created optimistically, and this runs later (kicked fire-and-forget + swept by cron).
 *
 * Per-pitch status machine, all service-role (bypasses RLS — the worker is the sole writer to the derived
 * tables): uploading/recorded → transcribing → analyzing → complete. On a transient failure the pitch is
 * pushed out with exponential backoff (retryBackoff); at MAX_PITCH_ATTEMPTS it becomes terminal `failed`
 * with a human-readable error (surfaced in the Report Card, NEVER the Door Log) and reported to Sentry.
 */

type PitchRow = {
  id: string;
  company_id: string;
  rep_id: string;
  audio_path: string | null;
  status: string;
  attempts: number;
};

/** Read the pitch's outcome + duration (from its knock) for the analysis step. */
async function pitchContext(pitchId: string): Promise<{ outcome: string; durationMs: number | null } | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("pitches")
    .select("duration_ms, door_knocks!inner(outcome)")
    .eq("id", pitchId)
    .maybeSingle();
  if (!data) return null;
  const knock = data.door_knocks as unknown as { outcome: string } | { outcome: string }[];
  const outcome = Array.isArray(knock) ? knock[0]?.outcome : knock?.outcome;
  return { outcome: outcome ?? "unknown", durationMs: (data.duration_ms as number | null) ?? null };
}

/** Process one pitch through the pipeline. Never throws — failures become retry/terminal state. */
export async function processPitch(pitch: PitchRow): Promise<void> {
  // Atomic claim FIRST: only one of the two entry points (the route's fire-and-forget kick and the cron sweep)
  // may do the paid STT + LLM work for a given pitch. The loser of the lease race returns without spending.
  if (!(await claimPitchForProcessing(pitch.id))) return;
  try {
    const sb = createAdminClient();
    // F4: skip the (paid) STT step if a transcript ALREADY exists. A retry after an analyze-stage failure
    // must not re-run ElevenLabs — gate transcription on transcript-existence, not the volatile claim-time
    // status (which resets to "uploading" on a mid-pipeline failure and would otherwise re-transcribe).
    const { data: existingTr } = await sb
      .from("pitch_transcripts")
      .select("pitch_id")
      .eq("pitch_id", pitch.id)
      .maybeSingle();

    // 1. Transcribe (only if there's no transcript yet).
    if (!existingTr && ["uploading", "recorded", "transcribing"].includes(pitch.status)) {
      if (!pitch.audio_path) {
        await setPitchStatus({ pitchId: pitch.id, status: "failed", error: "No audio was captured for this pitch." });
        return;
      }
      await setPitchStatus({ pitchId: pitch.id, status: "transcribing" });
      // Durable path (founder 2026-08-22): audio_path points at a stitched recording built from chunks that
      // uploaded DURING recording (survives a long-call upload failure OR a recorder that stopped early). Stitch
      // them now — idempotent, so a retry or the route's earlier run is a no-op. No chunks reached storage →
      // nothing was captured → honest terminal failure; a transient list/upload error is retryable (throw).
      const rid = recordingIdFromAudioPath(pitch.audio_path);
      if (rid) {
        const st = await stitchPitchAudio({ companyId: pitch.company_id, recordingId: rid });
        if (!st.ok) {
          if (/no chunks|no readable/i.test(st.reason ?? "")) {
            await setPitchStatus({ pitchId: pitch.id, status: "failed", error: "No audio was captured for this pitch." });
            return;
          }
          throw new Error(`recording stitch failed: ${st.reason ?? "unknown"}`);
        }
      }
      const dl = await downloadAssetBytes({ storagePath: pitch.audio_path });
      if (!dl.ok) throw new Error(dl.error ?? "audio download failed");
      // A 0-byte / empty recording (a truncated upload, a muted mic) — an empty Buffer is TRUTHY, so guard the
      // LENGTH, not just presence. Nothing to transcribe → honest terminal, never a fabricated analysis (H1).
      if (!dl.bytes || dl.bytes.length === 0) {
        await setPitchStatus({ pitchId: pitch.id, status: "failed", error: "No audio was captured for this pitch." });
        return;
      }
      const text = await transcribeSpeech({ audio: dl.bytes, mimeType: dl.contentType ?? "audio/webm" });
      // Empty/silent capture (audit H1, founder 2026-08-22): STT returned no words. Do NOT run the analysis on an
      // empty transcript — the rubric schema forces a non-empty summary + scores, so it would produce a HOLLOW
      // "complete" pitch with MADE-UP scores (the "captured nothing but looks fine" trust-killer). Mark it
      // honestly instead. Terminal (an empty recording won't get less empty on retry).
      if (!text.trim()) {
        await setPitchStatus({ pitchId: pitch.id, status: "failed", error: "No speech was detected in this recording." });
        return;
      }
      await writePitchTranscript({
        pitchId: pitch.id,
        companyId: pitch.company_id,
        repId: pitch.rep_id,
        text,
        wordCount: text.trim().split(/\s+/).length,
      });
      await setPitchStatus({ pitchId: pitch.id, status: "analyzing" });
    }

    // 2. Analyze (reuses the rubric). Read back the transcript + outcome.
    const { data: tr } = await sb
      .from("pitch_transcripts")
      .select("text")
      .eq("pitch_id", pitch.id)
      .maybeSingle();
    const transcript = (tr?.text as string | undefined) ?? "";
    // Defense-in-depth (H1): never analyze an empty transcript — even if one was already persisted (an older
    // pitch reprocessed, or a silent recording). Analyzing "" fabricates a hollow "complete"; fail honestly.
    if (!transcript.trim()) {
      await setPitchStatus({ pitchId: pitch.id, status: "failed", error: "No speech was detected in this recording." });
      return;
    }
    const ctx = await pitchContext(pitch.id);
    const analysis = await analyzePitch({
      companyId: pitch.company_id,
      transcript,
      outcome: ctx?.outcome ?? "unknown",
      durationMs: ctx?.durationMs ?? null,
    });
    if (!analysis) throw new Error("analysis returned no result (empty/malformed) — retryable");

    await writePitchAnalysis({
      pitchId: pitch.id,
      companyId: pitch.company_id,
      repId: pitch.rep_id,
      summary: analysis.summary,
      strengths: analysis.strengths,
      improvements: analysis.improvements,
      scores: analysis.scores,
      model: "brain",
      promptVersion: ANALYSIS_PROMPT_VERSION,
    });
    await setPitchStatus({ pitchId: pitch.id, status: "complete" });
    // NOTE: rollup refresh is enqueued by the cron's rollup pass (keeps this step single-purpose).
  } catch (err) {
    const attempts = pitch.attempts + 1;
    const message = err instanceof Error ? err.message : String(err);
    if (isTerminalFailure(attempts)) {
      await setPitchStatus({
        pitchId: pitch.id,
        status: "failed",
        attempts,
        error: `Processing failed after ${attempts} attempts: ${message}`,
      });
      Sentry.captureException(err instanceof Error ? err : new Error(message), {
        tags: { feature: "macro-mode", stage: "pitch-processing" },
        extra: { pitchId: pitch.id },
      });
    } else {
      // Transient — back off and let the cron re-claim it. Keep the current status so it resumes there.
      await setPitchStatus({
        pitchId: pitch.id,
        status: pitch.status as "uploading" | "transcribing" | "analyzing",
        attempts,
        runAfter: new Date(Date.now() + backoffMs(attempts)),
      });
    }
  }
}

/** Sweep + process the next batch of due pitches (the cron entry point). Returns how many it handled. */
export async function processDuePitches(limit = 10): Promise<number> {
  const pitches = (await claimPitchesToProcess(limit)) as PitchRow[];
  for (const p of pitches) {
    await processPitch(p);
  }
  return pitches.length;
}
