/**
 * Pitch-processing retry backoff (Macro Mode pipeline, 3.3 / 5.4). Pure, decision-independent logic.
 *
 * The worker sweeps `pitches` by (status, run_after). On a transient failure it bumps `attempts` and
 * pushes `run_after` out with exponential backoff; at `MAX_PITCH_ATTEMPTS` the pitch is terminal-`failed`
 * (surfaced in the Report Card, never the Door Log). This module is the schedule math only — the worker
 * persists the result — so it depends on none of the open questions.
 */

export const MAX_PITCH_ATTEMPTS = 5;

// The atomic claim lease MUST exceed the worker's processing budget. The kick route AND the cron both declare
// `export const maxDuration = 300` (s), so a run can take up to 300s. If the lease equalled that (it did — the old
// 5*60_000 = 300s), a pitch that runs the FULL budget has its lease expire at the exact moment maxDuration kills the
// run, letting the cron re-claim it in the boundary window → a duplicate STT/LLM pass (double spend). The 60s→300s
// route maxDuration bump (59005957) raised the KICK to the lease value and introduced that race on the kick path;
// this restores lease > budget with a 60s margin. Consumed by claimPitchForProcessing as its default leaseMs. The
// PITCH_LEASE_MS > PITCH_PROCESSING_MAX_MS invariant is drift-guarded in retryBackoff.test.ts.
export const PITCH_PROCESSING_MAX_MS = 300_000; // must match the route + cron `export const maxDuration = 300`
export const PITCH_LEASE_MS = PITCH_PROCESSING_MAX_MS + 60_000; // 360s — always keep > PITCH_PROCESSING_MAX_MS

// Base backoff was 30s → a pitch that recovered on attempt 3 waited 30+60=90s+, and a full 5-attempt churn spanned
// ~15min, which (2026-08-25 latency audit) is what inflated the after-pitch feedback AVERAGE to ~11min even though
// the MEDIAN pitch completes in ~30s. Lowered to 7s so a genuine TRANSIENT hiccup recovers in seconds: 14,28,56,112s
// ≈ 3.5min cumulative across 5 attempts, vs 15min. Permanent errors no longer reach this at all (isPermanentFailure).
const DEFAULT_BASE_MS = 7_000; // 7s
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

/**
 * A failure that RETRYING cannot fix — the pitch should terminalise IMMEDIATELY instead of churning the full
 * MAX_PITCH_ATTEMPTS backoff (~minutes) on an error that returns the identical result every attempt. This is the
 * biggest after-pitch LATENCY lever (2026-08-25 audit): permanent failures were the ~15-min-churn outliers dragging
 * the average up. Two classes, both grounded in the observed failed-pitch errors:
 *  - **bad audio content** — ElevenLabs 400 invalid_audio / invalid_content / "File is corrupted". The bytes won't
 *    change on retry, and the in-call bad-concat recovery has already run before this throws.
 *  - **missing account config** — "No brain row for company …" / "Company … not found". Won't self-heal without a
 *    config change; retrying just re-hits the same missing row.
 * CONSERVATIVE by design: a provider 5xx / timeout / network error is NOT permanent (genuinely transient → keeps its
 * backoff retries). Only classify what is DEFINITELY unfixable by retry, so a recoverable pitch is never killed early.
 */
export function isPermanentFailure(message: string): boolean {
  const m = message.toLowerCase();
  if (/invalid_audio|invalid_content|file is corrupted/.test(m)) return true; // bad audio CONTENT (a 400, not a 5xx)
  if (/no brain row|company\b.*\bnot found|no brain configured/.test(m)) return true; // missing config
  return false;
}
