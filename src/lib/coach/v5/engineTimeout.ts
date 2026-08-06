/**
 * Per-engine timeout for the multi-engine coach routes (finalize + summarize). Shared so the two routes
 * cannot DRIFT out of sync: the 2026-07-30 outage's latency dimension required raising this in BOTH routes,
 * and a future change should touch one place, not two. (Previously duplicated inline in each route.)
 *
 * 40s (raised from 25s on 2026-08-06). The active reasoning model deepseek-v4-flash spends ~15-40s per deep
 * engine (dissect/review) — reasoning + content — so a tighter bound degrades a COMPLETING engine to its
 * honest empty fallback, re-blanking "Your read" via timeout even after the token-budget fix. The engines run
 * in PARALLEL (Promise.all) under a 60s maxDuration, so wall-clock ≈ the slowest engine, not the sum — 40s
 * stays comfortably under budget. See reference_reasoning_model_token_starvation.
 */
export const COACH_ENGINE_TIMEOUT_MS = 40_000;

/**
 * Bound one engine call to COACH_ENGINE_TIMEOUT_MS, resolving to `fallback` (the engine's honest empty state)
 * if it doesn't finish in time. Behaviour-identical to the inline `withTimeout` the two routes carried.
 */
export function withEngineTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), COACH_ENGINE_TIMEOUT_MS)
    ),
  ]);
}
