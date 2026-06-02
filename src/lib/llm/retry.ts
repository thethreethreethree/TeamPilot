import "server-only";

import { LlmError } from "./errors";

/**
 * Run `fn` with exponential-backoff retries on retryable LlmError instances.
 * Non-retryable errors throw immediately. Returns the first successful result.
 *
 * Defaults:
 *   - 2 retries (3 attempts total)
 *   - 500ms initial delay, doubling each attempt, +/- 20% jitter
 *   - hard cap at 5s between retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; initialDelayMs?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const initial = opts.initialDelayMs ?? 500;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof LlmError && !err.retryable) throw err;
      if (attempt === maxAttempts - 1) throw err;
      const base = Math.min(initial * 2 ** attempt, 5000);
      // jitter ±20%
      const jitter = base * (0.8 + 0.4 * pseudoRandom(attempt));
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
  throw lastErr;
}

/** Cheap deterministic jitter that doesn't burn `Math.random()` across runs. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Wrap a fetch call with a timeout (AbortController). Throws an LlmError of
 * kind 'timeout' if the timeout fires before the request resolves.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  args: { timeoutMs: number; provider: string }
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new LlmError({
        kind: "timeout",
        message: `Request to ${args.provider} timed out after ${args.timeoutMs}ms`,
        provider: args.provider,
      });
    }
    throw new LlmError({
      kind: "network",
      message: err instanceof Error ? err.message : "Network error",
      provider: args.provider,
    });
  } finally {
    clearTimeout(timer);
  }
}
