import "server-only";
import { LlmError, isProviderOutage } from "./errors";

/**
 * STOP CALLING A PROVIDER THAT IS NOT ANSWERING (2026-10-02).
 *
 * On 2026-10-01 from about 19:27 UTC DeepSeek stopped answering (their status page: degraded performance). Every
 * AI call waited out its 45 s timeout before failing, so the every-minute pitch cron ran into its 300 s limit on
 * every run and live features hung for 45 s per request. Founder, picker 2026-10-02: "DeepSeek only, fail fast":
 * remember the outage so calls fail in seconds, and let pitches wait in the queue (worker.ts) until it returns.
 *
 * After OPEN_AFTER outage-class failures in a row (isProviderOutage: timeout, 5xx, unreachable), calls fail at
 * once for OPEN_MS. When that passes, the next call goes through as a probe: success closes the breaker, another
 * outage failure opens it again straight away (the count is still at the threshold). A success at any time
 * resets the count, so one slow call among good ones never opens it.
 *
 * Scope: memory of ONE server instance. Vercel reuses warm instances across requests, so a busy instance learns
 * once and every later call on it is fast; a fresh instance pays the timeout at most OPEN_AFTER times before it
 * learns too. No database row, so no migration and nothing to clean up after an outage.
 */
export const OPEN_AFTER = 2;
export const OPEN_MS = 60_000;

type Health = { failures: number; openUntil: number };
const health = new Map<string, Health>();

/** Throw the fail-fast error if `provider` is in a known outage. Call before each request. */
export function assertProviderAvailable(provider: string, now: number = Date.now()): void {
  const h = health.get(provider);
  if (!h || now >= h.openUntil) return;
  throw new LlmError({
    kind: "server",
    provider,
    retryable: false,
    message: `${provider} skipped: ${h.failures} failures in a row (timeout, 5xx or unreachable); calls resume after ${new Date(h.openUntil).toISOString()}.`,
  });
}

/** Record how one logical call ended (after its retries). Only outage-class failures count. */
export function recordProviderResult(provider: string, err: unknown, now: number = Date.now()): void {
  if (!err) {
    health.delete(provider);
    return;
  }
  if (!isProviderOutage(err)) return;
  const h = health.get(provider) ?? { failures: 0, openUntil: 0 };
  h.failures += 1;
  if (h.failures >= OPEN_AFTER) {
    h.openUntil = now + OPEN_MS;
    // eslint-disable-next-line no-console
    console.error(
      `[llm] ${provider} not answering (${h.failures} outage failures in a row); failing fast until ${new Date(h.openUntil).toISOString()}.`
    );
  }
  health.set(provider, h);
}

/** Tests only. */
export function _resetProviderHealth(): void {
  health.clear();
}
