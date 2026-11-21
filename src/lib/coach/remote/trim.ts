/**
 * Trimming a section out of a call (RSS Phase 8, migration 0284; Gong F9.17). Pure rules; the route does the IO.
 *
 * A trim is a row; undoing it is a restore row (§3.1). What a trim removes from the transcript is decided in SQL
 * (rss_line_trimmed, inside coaching_transcript_segments_current) so every reader and every later version agrees;
 * the player skips the same ranges with activeTrims.
 */
export const MIN_TRIM_MS = 1000;

export class TrimError extends Error {}

/** Throws TrimError with a sentence for the person. sessionMs null = length unknown (no upper bound check). */
export function validateTrim(startMs: number, endMs: number, sessionMs: number | null): void {
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs)) throw new TrimError("Pick the start and end of the section.");
  if (startMs < 0) throw new TrimError("The section can't start before the call does.");
  if (endMs - startMs < MIN_TRIM_MS) throw new TrimError("Pick a section at least one second long.");
  if (sessionMs !== null && startMs >= sessionMs) throw new TrimError("That section is after the end of the call.");
}

export type TrimRow = { id: string; start_ms: number; end_ms: number; created_at: string; trimmed_by: string };

/** The trims still in force (not restored), earliest first. Pure. */
export function activeTrims(trims: TrimRow[], restoredIds: Iterable<string>): TrimRow[] {
  const restored = new Set(restoredIds);
  return trims.filter((t) => !restored.has(t.id)).sort((a, b) => a.start_ms - b.start_ms);
}

/** Where playback should jump to if `atMs` falls inside an active trim; null when it does not. Pure. */
export function skipTo(atMs: number, active: Array<Pick<TrimRow, "start_ms" | "end_ms">>): number | null {
  let to: number | null = null;
  let at = atMs;
  // Adjacent or overlapping trims chain: keep jumping until outside all of them.
  for (let guard = 0; guard < active.length + 1; guard++) {
    const hit = active.find((t) => at >= t.start_ms && at < t.end_ms);
    if (!hit) break;
    to = hit.end_ms;
    at = hit.end_ms;
  }
  return to;
}
