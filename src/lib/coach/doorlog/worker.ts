import "server-only";
import { after } from "next/server";
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
import { backoffMs, isTerminalFailure, MAX_PITCH_ATTEMPTS } from "./retryBackoff";
import { stitchPitchAudio, recordingIdFromAudioPath } from "./pitchAudioChunks";
import { describeAudioBytes, truncateAtSecondInitSegment, startsWithNewRecordingHeader } from "@/lib/coach/v5/stitchSessionAudio";
import { rollupRep } from "./rollupWorker";

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

/**
 * Best-effort status write for the FAILURE paths (poison-terminal + the catch). setPitchStatus now THROWS on a DB
 * error (audit H3), but processPitch must never throw (its contract + the cron loop). If we can't even persist the
 * failure state, swallow + report: the lease expires and the cron re-claims it, so the record still progresses.
 */
async function recordFailureStatus(args: Parameters<typeof setPitchStatus>[0]): Promise<void> {
  try {
    await setPitchStatus(args);
  } catch (err) {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { feature: "macro-mode", stage: "pitch-processing-persist" },
      extra: { pitchId: args.pitchId },
    });
  }
}

/** Process one pitch through the pipeline. Never throws — failures become retry/terminal state. */
export async function processPitch(pitch: PitchRow): Promise<void> {
  // Atomic claim FIRST: only one of the two entry points (the route's fire-and-forget kick and the cron sweep)
  // may do the paid STT + LLM work for a given pitch. The loser of the lease race returns without spending.
  // The claim also ADVANCES `attempts` (audit H2) — so a crash/timeout that never reaches the catch below is
  // still counted, and a "poison" pitch eventually goes terminal instead of processing forever.
  const claim = await claimPitchForProcessing(pitch.id, pitch.attempts);
  if (!claim.won) return;
  const attempts = claim.attempts;
  // Poison-pitch backstop (audit H2, 2026-08-22): once the lease has pushed `attempts` PAST the ceiling, a prior
  // run must have hard-crashed (serverless timeout / OOM) without hitting the catch — re-processing would just
  // re-crash. Terminalise honestly instead of looping. `> MAX` (not `>=`) so the ordinary throw path still gets
  // its full MAX_PITCH_ATTEMPTS real tries, each terminalised by the catch at `>= MAX`.
  if (attempts > MAX_PITCH_ATTEMPTS) {
    await recordFailureStatus({
      pitchId: pitch.id,
      status: "failed",
      attempts,
      error: `Processing failed after ${attempts} attempts (a timeout or crash prevented completion).`,
    });
    Sentry.captureException(new Error("pitch processing exceeded max attempts (crash/timeout loop)"), {
      tags: { feature: "macro-mode", stage: "pitch-processing" },
      extra: { pitchId: pitch.id, attempts },
    });
    return;
  }
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
      // A NON-empty but UNPLAYABLE recording — one that doesn't begin with a valid container header (webm EBML /
      // mp4 ftyp). Ground truth 2026-08-25: a near-empty capture on the single-blob fallback path produced a 5-byte
      // webm *Cues* stub (head `1c53bb6b`), which is non-zero (so the length guard above passes) yet has no media.
      // ElevenLabs rejects it as "invalid_audio / corrupted", which reads as a transcription bug when it is really an
      // EMPTY capture. Fail HONESTLY (H1) — the true cause, not a misleading "corrupted" — and DON'T spend an STT
      // call on an unplayable file. Terminal: an empty capture won't refill on retry. (The recovery below handles the
      // opposite case — a VALID-header file that STT still rejects, e.g. a bad concat — so the two don't overlap.)
      if (!startsWithNewRecordingHeader(dl.bytes)) {
        console.error(
          `[pitch worker] pitch ${pitch.id} recording has no valid container header (empty/unplayable) — ${describeAudioBytes(dl.bytes, dl.contentType)}`
        );
        await setPitchStatus({
          pitchId: pitch.id,
          status: "failed",
          error: "No audio was captured for this pitch (the recording was empty or unplayable).",
        });
        return;
      }
      // Ground-truth capture on an STT rejection (feedback_recurring_failure_instrument_dont_assume): when
      // ElevenLabs calls the audio "corrupted/invalid", log its SIGNATURE — size, content-type, first-bytes magic
      // (webm EBML vs mp4 ftyp vs garbage), and a mid-file second-init hint (the bad-concat fingerprint). Appended
      // to the error so the terminal failure + Sentry NAME the cause as data instead of a guess, and re-thrown so
      // the existing retry/terminal machinery is unchanged.
      let text: string;
      try {
        text = await transcribeSpeech({ audio: dl.bytes, mimeType: dl.contentType ?? "audio/webm" });
      } catch (sttErr) {
        const sig = describeAudioBytes(dl.bytes, dl.contentType);
        const msg = sttErr instanceof Error ? sttErr.message : String(sttErr);
        console.error(`[pitch worker] STT rejected audio for pitch ${pitch.id} — ${sig}`);
        // Last-resort recovery (2026-08-25): a recording stitched BEFORE the mp4-reseam fix — whose chunks are now
        // purged, so a re-stitch can't help — may be a bad concat of two init segments, the exact shape STT rejects.
        // Retry ONCE with just the valid FIRST segment. This runs ONLY after STT already rejected the full buffer,
        // so it can't harm a good recording (a good recording passes STT and never reaches here) — worst case is a
        // wrong-offset split that STT rejects the same way (one wasted call). Also defense-in-depth for any future
        // container the reseam doesn't yet recognise. The mp4-reseam PREVENTS new bad concats; this SALVAGES old ones.
        const salvaged = truncateAtSecondInitSegment(dl.bytes);
        if (!salvaged) throw new Error(`${msg} [audio ${sig}]`);
        try {
          text = await transcribeSpeech({ audio: salvaged, mimeType: dl.contentType ?? "audio/webm" });
          console.error(
            `[pitch worker] recovered pitch ${pitch.id} from a bad concat — truncated ${dl.bytes.length}→${salvaged.length} bytes at the second init segment`
          );
        } catch {
          throw new Error(`${msg} [audio ${sig}] (first-segment retry after bad-concat truncation ALSO failed)`);
        }
      }
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
    // Refresh the rep's pattern rollup (the Next Door focus + Opportunities) NOW that a pitch completed — via
    // after() so it doesn't block, and so it fires on EVERY completion (the route's fire-and-forget kick AND the
    // cron), not ONLY the cron's separate rollup pass. That pass was the sole trigger and left
    // rep_pattern_summaries EMPTY despite 42 analyzed pitches (founder 2026-08-22: "Next Door focus isn't
    // generating") — a silent gap because the failure was invisible. Completion-path kick = the same reliable
    // mechanism that processes the pitch itself; the cron rollup pass remains a backstop. Best-effort: no request
    // context (a direct/test invocation) → skip and let the cron cover it.
    try {
      after(() =>
        rollupRep({
          companyId: pitch.company_id,
          repId: pitch.rep_id,
          todayIso: new Date().toISOString().slice(0, 10),
        })
      );
    } catch {
      /* no after() context here — the cron's rollup pass is the backstop */
    }
  } catch (err) {
    // `attempts` was already advanced at lease time (audit H2) — do NOT increment again here, or a thrown error
    // would double-count and terminalise too early.
    const message = err instanceof Error ? err.message : String(err);
    if (isTerminalFailure(attempts)) {
      await recordFailureStatus({
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
      // Transient — back off and let the cron re-claim it. Keep the current status so it resumes there; the lease
      // already set `attempts`, so leave it untouched (omitted) and only move `run_after`.
      await recordFailureStatus({
        pitchId: pitch.id,
        status: pitch.status as "uploading" | "transcribing" | "analyzing",
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
