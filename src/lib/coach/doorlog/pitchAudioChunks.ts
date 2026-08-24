import "server-only";
import { ASSETS_BUCKET, downloadAssetBytes, uploadAssetBytes } from "@/lib/storage/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderedChunkSeqs, startsWithNewRecordingHeader } from "@/lib/coach/v5/stitchSessionAudio";

/**
 * Incremental audio for a DoorLog PITCH — the "never lose the recording on a long call" durability layer
 * (founder 2026-08-22). Two field reports proved single-shot upload of the whole blob fails on long recordings
 * (the only 2 audio-less pitches in 48h were 5.6 min and 21 min; every short one saved) AND that the recorder
 * can stop mid-call (phone-lock / backgrounding ends the mic track). Both lose the recording.
 *
 * The cure mirrors the LIVE-coaching path (`stitchSessionAudio`): the recorder emits ~15s chunks that upload
 * DURING recording, so the audio is already in storage no matter how the recording ends, and the whole thing
 * never rides on one large final upload. This module is the pitch-side of that: the chunk storage layout + the
 * stitch. It REUSES the live path's pure, tested helpers (`orderedChunkSeqs`, `startsWithNewRecordingHeader`) so
 * the concatenation semantics (contiguous-run, gap-truncates-tail, recorder-recreation-reseam for webm OR mp4)
 * can never drift between the two surfaces.
 *
 * Keyed on a client-generated `recordingId` (a uuid minted at Record-tap) — NOT the pitch id, because the
 * chunks upload while recording, BEFORE the pitch row exists (it's created at Save). The server derives the
 * companyId (never trusts a client path); the recordingId only ever scopes a folder under the caller's own
 * company, so it carries no cross-tenant capability.
 */

// SINGLE SOURCE for the pitch-chunk storage layout (§2.2): the chunk route WRITES here, the worker's stitch
// READS here. A drift silently loses the audio (written one place, stitched from another), so all consumers
// import these — never hand-build the path.
/** Folder holding a pitch recording's uploaded audio chunks. */
export const pitchChunkPrefix = (companyId: string, recordingId: string) =>
  `${companyId}/doorlog/${recordingId}/chunks`;
/** Storage path of one uploaded chunk. */
export const pitchChunkObjectPath = (companyId: string, recordingId: string, seq: number) =>
  `${pitchChunkPrefix(companyId, recordingId)}/${seq}.webm`;
/** Storage path of the final stitched recording (what `pitches.audio_path` points at). */
export const pitchRecordingPath = (companyId: string, recordingId: string) =>
  `${companyId}/doorlog/${recordingId}/recording.webm`;

/** A recordingId is a client uuid; validate its SHAPE so it can't smuggle path segments (`..`, `/`). */
export function isValidRecordingId(rid: string): boolean {
  return /^[a-zA-Z0-9-]{8,64}$/.test(rid);
}

/**
 * Extract the recordingId from a pitch's audio_path when it is a doorlog stitched-recording pointer
 * (`{companyId}/doorlog/{recordingId}/recording.webm`). Returns null for a legacy single-blob path (the
 * fallback upload) or any non-matching shape — so the worker knows whether to stitch-then-transcribe or
 * transcribe directly. Pure/testable.
 */
export function recordingIdFromAudioPath(audioPath: string | null | undefined): string | null {
  if (!audioPath) return null;
  const m = /^[^/]+\/doorlog\/([a-zA-Z0-9-]{8,64})\/recording\.webm$/.exec(audioPath);
  return m ? m[1]! : null;
}

/**
 * Stitch a pitch's incrementally-uploaded chunks into one recording at `pitchRecordingPath` and return whether
 * it now exists. IDEMPOTENT: if the final recording already exists (a prior stitch ran), returns ok without
 * re-doing the work. Contiguous-run + EBML-reseam semantics come from the shared helpers. Service-role
 * throughout; the path is pinned to the pitch's company + recordingId, never derived from live caller input.
 */
export async function stitchPitchAudio(args: {
  companyId: string;
  recordingId: string;
}): Promise<{ ok: boolean; storagePath?: string; bytes?: number; reason?: string }> {
  const admin = createAdminClient();
  const finalPath = pitchRecordingPath(args.companyId, args.recordingId);

  // Idempotent: a prior stitch (worker retry / cron) already produced the recording.
  const { data: existing } = await admin.storage
    .from(ASSETS_BUCKET)
    .list(`${args.companyId}/doorlog/${args.recordingId}`, { limit: 100 });
  if ((existing ?? []).some((o) => o.name === "recording.webm")) {
    return { ok: true, storagePath: finalPath, reason: "already stitched" };
  }

  const prefix = pitchChunkPrefix(args.companyId, args.recordingId);
  const { data: objects, error: listErr } = await admin.storage
    .from(ASSETS_BUCKET)
    .list(prefix, { limit: 4000 });
  if (listErr) return { ok: false, reason: `list: ${listErr.message}` };
  const order = orderedChunkSeqs((objects ?? []).map((o) => o.name));
  if (order.length === 0) return { ok: false, reason: "no chunks" };

  const parts: Buffer[] = [];
  let chunkContentType = "audio/webm"; // preserved from the chunks — iOS Safari records audio/mp4, not webm
  for (let i = 0; i < order.length; i++) {
    const dl = await downloadAssetBytes({ storagePath: pitchChunkObjectPath(args.companyId, args.recordingId, order[i]!) });
    if (!dl.ok || !dl.bytes) break; // stop at the first unreadable chunk — keep the valid head, drop the tail
    if (i === 0 && dl.contentType) chunkContentType = dl.contentType; // the recording's real format
    if (i > 0 && startsWithNewRecordingHeader(dl.bytes)) break; // recorder recreated (webm OR iOS mp4) — keep segment 1
    parts.push(dl.bytes);
  }
  if (parts.length === 0) return { ok: false, reason: "no readable chunks" };
  const merged = Buffer.concat(parts);

  // Label the stitched recording with the ACTUAL format (founder 2026-08-23) — hardcoding audio/webm mislabeled
  // iOS's mp4 recording, so the worker handed mp4 bytes to STT as webm. downloadAssetBytes reads this back as
  // dl.contentType, which the worker passes to transcription.
  const up = await uploadAssetBytes({ storagePath: finalPath, bytes: merged, contentType: chunkContentType });
  if (!up.ok) return { ok: false, reason: `upload: ${up.error}` };

  // Best-effort: drop the chunk objects now that the canonical recording exists (retention sweeps orphans too).
  try {
    await admin.storage.from(ASSETS_BUCKET).remove(order.map((s) => pitchChunkObjectPath(args.companyId, args.recordingId, s)));
  } catch {
    /* noop — orphan chunks are harmless */
  }
  return { ok: true, storagePath: finalPath, bytes: merged.length };
}
