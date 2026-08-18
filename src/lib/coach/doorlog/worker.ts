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
} from "@/lib/data/doorlog";
import { backoffMs, isTerminalFailure } from "./retryBackoff";

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
  try {
    // 1. Transcribe (if not already past it).
    if (["uploading", "recorded", "transcribing"].includes(pitch.status)) {
      if (!pitch.audio_path) {
        await setPitchStatus({ pitchId: pitch.id, status: "failed", error: "No audio was captured for this pitch." });
        return;
      }
      await setPitchStatus({ pitchId: pitch.id, status: "transcribing" });
      const dl = await downloadAssetBytes({ storagePath: pitch.audio_path });
      if (!dl.ok || !dl.bytes) throw new Error(dl.error ?? "audio download failed");
      const text = await transcribeSpeech({ audio: dl.bytes, mimeType: dl.contentType ?? "audio/webm" });
      await writePitchTranscript({
        pitchId: pitch.id,
        companyId: pitch.company_id,
        repId: pitch.rep_id,
        text,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      });
      await setPitchStatus({ pitchId: pitch.id, status: "analyzing" });
    }

    // 2. Analyze (reuses the rubric). Read back the transcript + outcome.
    const sb = createAdminClient();
    const { data: tr } = await sb
      .from("pitch_transcripts")
      .select("text")
      .eq("pitch_id", pitch.id)
      .maybeSingle();
    const transcript = (tr?.text as string | undefined) ?? "";
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
