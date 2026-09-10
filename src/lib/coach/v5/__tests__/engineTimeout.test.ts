import { describe, it, expect, vi, afterEach } from "vitest";
import { withEngineTimeout, COACH_ENGINE_TIMEOUT_MS } from "../engineTimeout";

/**
 * engineTimeout — a timeout is not an empty result, and the difference has to reach the record.
 *
 * Every coach engine degrades to the same empty value whether it ran out of time or genuinely
 * had nothing to say. Nothing recorded which, and that is the whole question a rep asks when a
 * call comes back uncoached. Measured on production 2026-09-10: artifact coverage collapses as
 * the transcript GROWS (moments 87% under 50 words, 29% between 200 and 600) — backwards from
 * any "no signal" explanation, and the shape a per-call time bound makes.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("withEngineTimeout", () => {
  it("passes a finished engine's value straight through, and reports no timeout", async () => {
    const onTimeout = vi.fn();
    await expect(
      withEngineTimeout(Promise.resolve("the real answer"), null, onTimeout)
    ).resolves.toBe("the real answer");
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("REPORTS the timeout, so an abandoned engine is not filed as a quiet one", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    // An engine that never settles — the pathological case the bound exists for.
    const p = withEngineTimeout(new Promise<string>(() => {}), "fallback", onTimeout);
    await vi.advanceTimersByTimeAsync(COACH_ENGINE_TIMEOUT_MS);
    await expect(p).resolves.toBe("fallback");
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does not fire before the bound is reached", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    void withEngineTimeout(new Promise<string>(() => {}), "fallback", onTimeout);
    await vi.advanceTimersByTimeAsync(COACH_ENGINE_TIMEOUT_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("a note that throws never becomes the failure it was recording", async () => {
    // onTimeout is a note taken on the way past. If recording the problem could itself
    // break the generation, the recording would be worse than the silence it replaced.
    vi.useFakeTimers();
    const p = withEngineTimeout(new Promise<string>(() => {}), "fallback", () => {
      throw new Error("the event write blew up");
    });
    await vi.advanceTimersByTimeAsync(COACH_ENGINE_TIMEOUT_MS);
    await expect(p).resolves.toBe("fallback");
  });

  it("works with no note at all — the callback is optional", async () => {
    vi.useFakeTimers();
    const p = withEngineTimeout(new Promise<string>(() => {}), "fallback");
    await vi.advanceTimersByTimeAsync(COACH_ENGINE_TIMEOUT_MS);
    await expect(p).resolves.toBe("fallback");
  });

  it("a REJECTING engine still rejects — the bound is not an error swallower", async () => {
    // The call sites attach their own .catch(fallback). If this helper swallowed rejections
    // too, a genuine engine error would become indistinguishable from a timeout, which is
    // the exact conflation this whole change exists to end.
    const onTimeout = vi.fn();
    await expect(
      withEngineTimeout(Promise.reject(new Error("engine blew up")), "fallback", onTimeout)
    ).rejects.toThrow("engine blew up");
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
