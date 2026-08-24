import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSETS_BUCKET, downloadAssetBytes } from "@/lib/storage/assets";

/**
 * Stitch a live session's incrementally-uploaded audio chunks into one recording and stamp `audio_asset_url`
 * (founder 2026-08-21 — "never lose the recording"). During a call the recorder uploads a chunk every ~15s to
 * `${companyId}/${sessionId}/chunks/${seq}.webm`; this concatenates them into the final
 * `${companyId}/${sessionId}/recording.webm` so the audio survives ANY ending (drop / tab-close / phone-lock /
 * crash / never-Stop) — not only a clean Stop. Sequential MediaRecorder chunks byte-concatenate into a valid
 * webm, so ORDER matters and a gap truncates the tail (never corrupts the head).
 *
 * IDEMPOTENT: skips when `audio_asset_url` is already set (a clean Stop's `persistRecording` may have already
 * uploaded the full blob, or a prior stitch ran). Service-role throughout (the worker/cron have no user
 * session); path is pinned to the session's company, never derived from caller input.
 */

// SINGLE SOURCE for the incremental-audio storage layout (§2.2) — the chunk-upload route WRITES chunks here,
// this stitch READS them, and the recording-purge cron CLEANS them, so the three must never drift (a mismatch
// silently loses the audio: chunks written to one path, stitched/purged from another). All three import these.
/** Prefix (folder) holding a session's uploaded audio chunks. */
export const chunkPrefix = (companyId: string, sessionId: string) => `${companyId}/${sessionId}/chunks`;
/** Storage path of one uploaded chunk. */
export const chunkObjectPath = (companyId: string, sessionId: string, seq: number) =>
  `${chunkPrefix(companyId, sessionId)}/${seq}.webm`;
/** Storage path of the final stitched recording. */
export const finalRecordingPath = (companyId: string, sessionId: string) =>
  `${companyId}/${sessionId}/recording.webm`;

/**
 * From the chunk object names (`"0.webm"`, `"1.webm"`, …) return the CONTIGUOUS seq run starting at 0 — the
 * portion that byte-concatenates into a valid recording. Stops at the first gap (a dropped chunk truncates the
 * tail, keeping the valid head) and ignores duplicates / non-numeric names. Pure, so it's unit-testable.
 */
export function orderedChunkSeqs(names: string[]): number[] {
  const seqs = names
    .map((n) => Number(String(n).replace(/\.webm$/i, "")))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);
  const contiguous: number[] = [];
  let expected = 0;
  for (const s of seqs) {
    if (s === expected) {
      contiguous.push(s);
      expected += 1;
    } else if (s > expected) {
      break; // gap — stop; the head is intact, the tail is dropped
    }
    // s < expected → duplicate; skip
  }
  return contiguous;
}

/**
 * True if the buffer begins with the EBML/webm magic (0x1A45DFA3) — i.e. it is the START of a webm recording.
 * A MediaRecorder emits this header only in its FIRST chunk; a SECOND occurrence mid-stream means the recorder
 * was recreated during the session (e.g. a mobile screen-lock ended the mic track and P0 rebuilt the recorder).
 * Those two segments cannot be byte-concatenated into one valid webm, so the stitch stops at the boundary and
 * keeps the first (valid) segment — the pre-lock audio, still playable AND transcribable. Pure/testable.
 */
export function startsWithEbmlHeader(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

/**
 * True if the buffer begins with an mp4/ISO-BMFF init segment — an `ftyp` box (type bytes at offset 4, after the
 * 4-byte box size). iOS Safari records `audio/mp4` (MediaRecorder webm→mp4 fallback), so on iOS a recorder
 * recreation emits a fresh `ftyp`+`moov` init; a continuation fragment of the SAME recording starts with `moof`,
 * not `ftyp`, so this only matches a genuine NEW recording start — the mp4 twin of startsWithEbmlHeader.
 * (2026-08-25: the webm-only reseam let two iOS mp4 segments concatenate → ElevenLabs "invalid_audio / corrupted".)
 */
export function startsWithMp4InitSegment(buf: Buffer): boolean {
  return buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70; // "ftyp"
}

/** True if the buffer is the START of a NEW recording in EITHER container the pipeline records (webm OR mp4). */
export function startsWithNewRecordingHeader(buf: Buffer): boolean {
  return startsWithEbmlHeader(buf) || startsWithMp4InitSegment(buf);
}

/**
 * The bad-concat fingerprint: the offset of a SECOND recording-init header (webm EBML past byte 0, or mp4 `ftyp`
 * past the legitimate first one at offset 4), or -1. A positive result on a stitched file means two recordings
 * were concatenated — exactly what the mp4-aware reseam prevents. Heuristic (a byte run could coincide in audio
 * payload), so it's a DIAGNOSTIC hint, never a gate. `Buffer.indexOf` is native (fast on multi-MB audio).
 */
export function findSecondInitSegment(buf: Buffer): number {
  const ebml = buf.indexOf(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 1);
  if (ebml >= 0) return ebml;
  return buf.indexOf(Buffer.from([0x66, 0x74, 0x79, 0x70]), 8); // "ftyp" past the first init's ftyp@4
}

/**
 * LAST-RESORT recovery for a bad concat: if `buf` glues two recordings together (a SECOND init header mid-file —
 * the exact shape ElevenLabs rejects as "invalid_audio / corrupted"), return just the valid FIRST segment;
 * otherwise null. Use ONLY after STT has ALREADY rejected the full buffer, never proactively — findSecondInitSegment
 * is a heuristic, so truncating a GOOD file could corrupt it, but a good file passes STT and never reaches this
 * path; on an already-rejected buffer a wrong-offset split just fails STT the same way (one wasted call, no data
 * harm). This salvages recordings stitched BEFORE the mp4-reseam fix — whose chunks are purged, so a re-stitch
 * can't help, yet the cached bad file can still be split here — and is defense-in-depth for any future container
 * the reseam doesn't yet recognise. Pure/testable.
 */
export function truncateAtSecondInitSegment(buf: Buffer): Buffer | null {
  const at = findSecondInitSegment(buf);
  if (at <= 0) return null; // no mid-file second init (or it's at 0 — not a concat) → nothing to salvage
  return buf.subarray(0, at);
}

/**
 * Ground-truth signature of an audio buffer for a failure log (feedback_recurring_failure_instrument_dont_assume):
 * size, content-type, the first 16 bytes (magic → webm EBML / mp4 ftyp / garbage), and a mid-file second-init hint.
 * So when STT rejects audio as "corrupted", the log NAMES why (bad concat / wrong format / truncation) as DATA.
 */
export function describeAudioBytes(buf: Buffer, contentType?: string | null): string {
  const secondInit = findSecondInitSegment(buf);
  return (
    `size=${buf.length} ct=${contentType ?? "?"} head=${buf.subarray(0, 16).toString("hex")}` +
    (secondInit >= 0 ? ` secondInit@${secondInit}(bad-concat?)` : "")
  );
}

export async function stitchSessionAudio(args: {
  companyId: string;
  sessionId: string;
}): Promise<{ stitched: boolean; reason?: string; bytes?: number }> {
  const admin = createAdminClient();

  // Idempotent guard — never overwrite an audio pointer a clean Stop (or a prior stitch) already set.
  const { data: sess } = await admin
    .from("coaching_sessions")
    .select("audio_asset_url")
    .eq("id", args.sessionId)
    .maybeSingle();
  if (!sess) return { stitched: false, reason: "session not found" };
  if (sess.audio_asset_url) return { stitched: false, reason: "already has audio" };

  const prefix = chunkPrefix(args.companyId, args.sessionId);
  const { data: objects, error: listErr } = await admin.storage
    .from(ASSETS_BUCKET)
    .list(prefix, { limit: 2000 });
  if (listErr) return { stitched: false, reason: `list: ${listErr.message}` };
  const order = orderedChunkSeqs((objects ?? []).map((o) => o.name));
  if (order.length === 0) return { stitched: false, reason: "no chunks" };

  const parts: Buffer[] = [];
  for (let i = 0; i < order.length; i++) {
    const dl = await downloadAssetBytes({ storagePath: chunkObjectPath(args.companyId, args.sessionId, order[i]!) });
    if (!dl.ok || !dl.bytes) break; // stop at the first unreadable chunk — truncate the tail, keep the head
    // A new recording header AFTER the first chunk = the recorder was recreated mid-session (mobile screen-lock
    // ended the mic track → P0 rebuilt it). The two segments can't be concatenated into one valid file, so stop
    // and keep the first (valid) segment — the pre-lock audio, still playable + transcribable. Container-aware
    // (2026-08-25): webm EBML OR mp4 ftyp — iOS records mp4, and the old webm-only check let two mp4 segments
    // concatenate into an unplayable file (ElevenLabs "corrupted"). Without this the stitch corrupts from the seam on.
    if (i > 0 && startsWithNewRecordingHeader(dl.bytes)) break;
    parts.push(dl.bytes);
  }
  if (parts.length === 0) return { stitched: false, reason: "no readable chunks" };
  const merged = Buffer.concat(parts);

  const fpath = finalRecordingPath(args.companyId, args.sessionId);
  const { error: upErr } = await admin.storage
    .from(ASSETS_BUCKET)
    .upload(fpath, merged, { contentType: "audio/webm", upsert: true });
  if (upErr) return { stitched: false, reason: `upload: ${upErr.message}` };

  // Stamp the pointer in the SAME shape upload-recording writes + recording-purge-cron expects:
  // `${bucket}/${path}`. Re-scope to audio_asset_url IS NULL so a concurrent clean-Stop persist wins cleanly.
  const { data: stamped, error: updErr } = await admin
    .from("coaching_sessions")
    .update({ audio_asset_url: `${ASSETS_BUCKET}/${fpath}` })
    .eq("id", args.sessionId)
    .is("audio_asset_url", null)
    .select("id");
  if (updErr) return { stitched: false, reason: `stamp: ${updErr.message}` };
  if ((stamped?.length ?? 0) === 0) return { stitched: false, reason: "raced — audio set concurrently" };

  // Best-effort: drop the chunk objects now that the canonical recording exists.
  try {
    await admin.storage.from(ASSETS_BUCKET).remove(order.map((s) => chunkObjectPath(args.companyId, args.sessionId, s)));
  } catch {
    /* noop — orphan chunks are harmless; the purge/retention sweeps them by prefix age */
  }
  return { stitched: true, bytes: merged.length };
}
