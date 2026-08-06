import { describe, it, expect, vi } from "vitest";
import { withEngineTimeout, COACH_ENGINE_TIMEOUT_MS } from "../engineTimeout";

/**
 * Guards the shared per-engine timeout used by finalize + summarize. Extracted so the two routes can't drift
 * (the 2026-07-30 outage's latency dimension required raising it in BOTH). The floor test below pins the value
 * high enough for the reasoning model so a future edit can't quietly drop it back toward 25s and re-blank
 * heavy-reasoning reads via timeout. See reference_reasoning_model_token_starvation.
 */
describe("withEngineTimeout", () => {
  it("resolves to the real value when the engine finishes before the timeout", async () => {
    expect(await withEngineTimeout(Promise.resolve("real"), "fallback")).toBe(
      "real"
    );
  });

  it("resolves to the fallback (honest empty state) when the engine exceeds the timeout", async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>((r) =>
      setTimeout(() => r("real"), COACH_ENGINE_TIMEOUT_MS + 1_000)
    );
    const raced = withEngineTimeout(slow, "fallback");
    await vi.advanceTimersByTimeAsync(COACH_ENGINE_TIMEOUT_MS + 1);
    expect(await raced).toBe("fallback");
    vi.useRealTimers();
  });

  it("keeps the timeout floor high enough for the reasoning model (>= 40s)", () => {
    // deepseek-v4-flash spends ~15-40s per deep engine; below this a completing engine degrades to empty.
    expect(COACH_ENGINE_TIMEOUT_MS).toBeGreaterThanOrEqual(40_000);
  });
});
