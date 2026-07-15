/**
 * The 3-day silent-observe window (ELOSTATE spec 4.3a, §3.4).
 *
 * For a Standard rep's first days on the coach, the AI LISTENS — records and
 * reviews the call — but delivers no proactive in-ear cue. Advice starts once the
 * window closes. Extracted from the cue route as a PURE function so the boundary
 * (exactly 3 days, off-by-one either way) is explicit and unit-tested: a window
 * that fires a day early or lingers a day late is the classic bug here, and it is
 * invisible without a test that pins the edge.
 *
 * Honest by construction (§3.4): a rep with NO recorded start (startedAt null) is
 * NOT in the window — we never suppress advice on the basis of a date we don't
 * have. A malformed date is treated the same way (not in the window) rather than
 * silently suppressing.
 */

/** The window length. 3 calendar days from the rep's first session. */
export const OBSERVE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Is this rep still inside their observe window?
 *
 * @param startedAt the rep's earliest session timestamp (ISO), or null if none
 * @param nowMs     the current time in ms (injected so the boundary is testable)
 * @returns true only when startedAt is a valid date AND now is strictly before
 *          startedAt + OBSERVE_WINDOW_MS. Exactly at the boundary → window is
 *          OVER (advice starts), so a rep is never held one tick too long.
 */
export function isWithinObserveWindow(
  startedAt: string | null | undefined,
  nowMs: number
): boolean {
  if (!startedAt) return false;
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return false;
  const ageMs = nowMs - startMs;
  // ageMs < 0 (a future start — clock skew) counts as in-window: we have not yet
  // begun observing, so we certainly should not be advising.
  return ageMs < OBSERVE_WINDOW_MS;
}

/** When the window closes, as an ISO string, or null if there's no start to
 *  anchor it. Surfaced to the rep so the "advice starts on <date>" notice is
 *  honest and matches the suppression exactly. */
export function observeWindowEndsAt(startedAt: string | null | undefined): string | null {
  if (!startedAt) return null;
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs + OBSERVE_WINDOW_MS).toISOString();
}
