/**
 * conversationDurationSeconds — the SINGLE source of the "how long was this call" rule that the After-Pitch
 * header, the Sessions list, and the KPI average-session-duration metric all read (audit F8, A30/§3.5).
 *
 * Returns the RAW effective length in seconds (fractional allowed) — each surface formats it as it likes
 * (After-Pitch rounds to "Xm Ys", the Sessions list floors to "Xm", KPI sums), so extracting this changes NO
 * display behaviour; it only removes the three hand-maintained copies of the CORE rule that previously carried
 * "keep in sync" comments with nothing enforcing them (the drift vein that let the "62m for a 4m clip" bug
 * span three surfaces at once).
 *
 * The rule: prefer an UPLOADED recording's true audio length (audioDurationSeconds > 0) — for an upload the
 * session wall-clock is just how long the session sat open; otherwise the started..ended wall-clock (correct
 * for a LIVE session); null when neither is known (never a fabricated number, §3.4). Guards a NaN/negative
 * wall-clock span (clock skew / bad timestamps) → null.
 *
 * UPPER SANITY CAP (2026-08-29, verified against live data): a wall-clock span beyond MAX_WALLCLOCK_SECONDS is
 * NOT a real call — it is an unclosed session or a mass-backfilled `ended_at`. Live data showed 230 sessions with
 * a >6h wall-clock and 200+ sharing a single backfilled `ended_at` (2026-08-21), started months earlier → spans of
 * ~54 DAYS. Averaged in, ONE of those produced the founder-reported "32051.9 min" avg-session-duration. The
 * audio-length path (real uploads) is unaffected — it is the trusted length and is never capped. A live span over
 * the cap returns null (§3.4: excluded as unknown, never a fabricated/clamped number that would still be wrong).
 */
export const MAX_WALLCLOCK_SECONDS = 4 * 60 * 60; // 4h — generous ceiling for any single call; real ones are minutes.

export function conversationDurationSeconds(
  audioDurationSeconds: number | null | undefined,
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): number | null {
  if (typeof audioDurationSeconds === "number" && audioDurationSeconds > 0) {
    return audioDurationSeconds;
  }
  if (startedAt && endedAt) {
    const ms = Date.parse(endedAt) - Date.parse(startedAt);
    if (Number.isFinite(ms) && ms > 0) {
      const sec = ms / 1000;
      // A span beyond the cap is an unclosed/backfilled session, not a real call length → unknown, not a poison.
      if (sec > MAX_WALLCLOCK_SECONDS) return null;
      return sec;
    }
  }
  return null;
}
