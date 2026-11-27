/**
 * The longest a call records (Gong F5.7: six hours). A recorder still live at six hours stops itself and says why; the
 * chunk route refuses audio from a call that started more than six hours ago (plus CLOCK_GRACE_MS for a browser clock
 * that runs a little off), so a recorder that missed its own stop can't keep filling storage. Pure, client-safe.
 */
export const MAX_CALL_MS = 6 * 60 * 60 * 1000;
export const CLOCK_GRACE_MS = 15 * 60 * 1000;
export const CALL_CAP_MESSAGE = "This call reached six hours, the most a call records, so recording stopped. Start a new call to keep going.";

/** How long until a call that went live at `startedAtMs` reaches the cap (0 when it already has). */
export function msUntilCap(startedAtMs: number, nowMs: number): number {
  return Math.max(0, MAX_CALL_MS - (nowMs - startedAtMs));
}

/** Whether the server should refuse more audio for a session that started at `startedAtIso`. */
export function pastCap(startedAtIso: string | null | undefined, nowMs: number): boolean {
  const t = startedAtIso ? Date.parse(startedAtIso) : NaN;
  return Number.isFinite(t) && nowMs - t > MAX_CALL_MS + CLOCK_GRACE_MS;
}
