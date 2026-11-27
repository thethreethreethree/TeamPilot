/**
 * The longest a call records (Gong F5.7: six hours). A recorder still running at six hours stops itself and says why.
 * The chunk route refuses any chunk past MAX_CALL_CHUNK (review 2026-11-27): recorders send one chunk per
 * AUDIO_CHUNK_MS (15 s, both live and meeting recorders), so six hours is 1,440 chunks — counting chunks needs no clock
 * (a browser clock can be off) and covers recorders that never send a start time. Pure, client-safe.
 */
export const MAX_CALL_MS = 6 * 60 * 60 * 1000;
export const CLOCK_GRACE_MS = 15 * 60 * 1000;
/** Both recorders' chunk length (useLiveCoaching / useMeetingCoaching AUDIO_CHUNK_MS). */
export const CHUNK_MS = 15_000;
/** The last chunk number the server keeps: six hours plus 15 minutes of chunks (a forced chunk can come a little early). */
export const MAX_CALL_CHUNK = Math.ceil((MAX_CALL_MS + CLOCK_GRACE_MS) / CHUNK_MS);
export const CALL_CAP_MESSAGE = "This call reached six hours, the most a call records, so recording stopped. The recording so far is kept.";

/** How long until a call that went live at `startedAtMs` reaches the cap (0 when it already has). */
export function msUntilCap(startedAtMs: number, nowMs: number): number {
  return Math.max(0, MAX_CALL_MS - (nowMs - startedAtMs));
}

/** Whether the server refuses this chunk: past six hours (plus grace) of chunks. */
export function pastCapChunk(seq: number): boolean {
  return seq > MAX_CALL_CHUNK;
}
