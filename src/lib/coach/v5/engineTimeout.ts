/**
 * Per-engine timeout for the multi-engine coach routes (finalize + summarize + the shared
 * generateSessionArtifacts). Shared so the call sites cannot DRIFT out of sync: the
 * 2026-07-30 outage's latency dimension required raising this in BOTH routes, and a future
 * change should touch one place, not two.
 *
 * 40s (raised from 25s on 2026-08-06). The active reasoning model deepseek-v4-flash spends
 * ~15-40s per deep engine (dissect/review) — reasoning + content — so a tighter bound
 * degrades a COMPLETING engine to its empty fallback. The engines run in PARALLEL under the
 * route's maxDuration, so wall-clock ≈ the slowest engine, not the sum.
 *
 * A TIMEOUT IS NOT AN EMPTY RESULT, and until 2026-09-10 this file called the fallback
 * "honest", which it is not. An engine that ran out of time HAD something to say; an engine
 * with a thin transcript genuinely does not. Both produced the same value, nothing recorded
 * which, and the difference is the whole question a rep asks when a call comes back
 * uncoached.
 *
 * Measured on production that day, across the 168 sessions holding a transcript any engine
 * can read (they all filter on `speaker === "agent"`):
 *
 *     words in transcript   sessions   summary   dissect   pivot   moments
 *     0-50                        15       93%       93%     93%       87%
 *     50-200                      20      100%       95%     85%       75%
 *     200-600                     63       78%       63%     52%       29%
 *     600-2000                    65       78%       57%     57%       32%
 *     2000+                        5      100%       20%     60%       20%
 *
 * That is BACKWARDS from any "nothing to say" explanation — a 600-word sales conversation
 * has more to analyse than a 50-word one, not less. Coverage collapses as the transcript
 * grows, which is what a per-call time bound does. The longest, most valuable calls are the
 * ones least likely to be coached, and nothing anywhere said so.
 *
 * So the timeout now REPORTS itself. `onTimeout` lets the caller — which knows the session
 * and the company — record that this engine was abandoned, so an uncoached call can be told
 * apart from a quiet one. It deliberately does not change the bound: whether 40s is right is
 * a cost-and-latency decision, and it belongs to the founder, not to this file.
 *
 * NOTE the loser of the race is not cancelled. A timed-out engine keeps running and may
 * still persist its own result afterwards (each runAndStore* writes before returning), or
 * may be killed when the serverless function freezes. Which of those happened is exactly
 * what was never recorded.
 */
export const COACH_ENGINE_TIMEOUT_MS = 40_000;

/**
 * Bound one engine call to COACH_ENGINE_TIMEOUT_MS, resolving to `fallback` if it does not
 * finish in time.
 *
 * `onTimeout` fires only when the timer wins the race. It must not throw and must not be
 * slow — it is a note taken on the way past, never a second failure mode layered on the
 * first — so it is invoked inside a try/catch and its result is ignored.
 */
export function withEngineTimeout<T>(
  p: Promise<T>,
  fallback: T,
  onTimeout?: () => void
): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        try {
          onTimeout?.();
        } catch {
          /* a note that fails to be taken must not become the failure it was recording */
        }
        resolve(fallback);
      }, COACH_ENGINE_TIMEOUT_MS)
    ),
  ]);
}
