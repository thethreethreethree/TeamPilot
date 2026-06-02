import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "../retry";
import { LlmError } from "../errors";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the value when the first call succeeds (no retry)", async () => {
    const fn = vi.fn(async () => "ok");
    const out = await withRetry(fn);
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a non-retryable LlmError (auth) without retrying", async () => {
    const err = new LlmError({
      kind: "auth",
      message: "bad key",
      provider: "test",
    });
    const fn = vi.fn(async () => {
      throw err;
    });
    await expect(withRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxAttempts on a retryable LlmError (timeout)", async () => {
    const err = new LlmError({
      kind: "timeout",
      message: "slow",
      provider: "test",
    });
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce("eventually");

    const promise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    // Drain all pending timers (the backoff sleeps).
    await vi.advanceTimersByTimeAsync(5000);
    const out = await promise;
    expect(out).toBe("eventually");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("after maxAttempts exhausted, the last error is thrown", async () => {
    const err = new LlmError({
      kind: "timeout",
      message: "always slow",
      provider: "test",
    });
    const fn = vi.fn(async () => {
      throw err;
    });

    const promise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
    // Attach rejection handler immediately so unhandled-rejection logic
    // doesn't fire while we advance timers.
    const assertion = expect(promise).rejects.toBe(err);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
