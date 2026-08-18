/**
 * Pitch-processing retry backoff (Macro Mode pipeline, 3.3 / 5.4). Pure, decision-independent logic.
 *
 * The worker sweeps `pitches` by (status, run_after). On a transient failure it bumps `attempts` and
 * pushes `run_after` out with exponential backoff; at `MAX_PITCH_ATTEMPTS` the pitch is terminal-`failed`
 * (surfaced in the Report Card, never the Door Log). This module is the schedule math only — the worker
 * persists the result — so it depends on none of the open questions.
 */

export const MAX_PITCH_ATTEMPTS = 5;
const DEFAULT_BASE_MS = 30_000; // 30s
const DEFAULT_CAP_MS = 3_600_000; // 1h ceiling

/** Delay before the next attempt: base · 2^attempts, capped. `attempts` = attempts already made. */
export function backoffMs(
  attempts: number,
  baseMs: number = DEFAULT_BASE_MS,
  capMs: number = DEFAULT_CAP_MS
): number {
  const n = Math.max(0, Math.floor(attempts));
  const delay = baseMs * 2 ** n;
  return Math.min(delay, capMs);
}

/** The `run_after` timestamp for the next attempt. */
export function nextRunAfter(now: Date, attempts: number, baseMs?: number): Date {
  return new Date(now.getTime() + backoffMs(attempts, baseMs));
}

/** True once retries are exhausted — the worker sets the pitch to terminal `failed` here. */
export function isTerminalFailure(attempts: number, maxAttempts: number = MAX_PITCH_ATTEMPTS): boolean {
  return attempts >= maxAttempts;
}
