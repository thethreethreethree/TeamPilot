import { describe, it, expect } from "vitest";
import {
  backoffMs,
  nextRunAfter,
  isTerminalFailure,
  MAX_PITCH_ATTEMPTS,
} from "../retryBackoff";

/**
 * 5.4 — backoff schedule grows exponentially and caps; max_attempts is a terminal state.
 */
describe("pitch-processing retry backoff", () => {
  it("grows exponentially from the 30s base", () => {
    expect(backoffMs(0)).toBe(30_000); // 30s
    expect(backoffMs(1)).toBe(60_000); // 1m
    expect(backoffMs(2)).toBe(120_000); // 2m
    expect(backoffMs(3)).toBe(240_000); // 4m
  });

  it("caps at the 1h ceiling instead of growing unbounded", () => {
    expect(backoffMs(20)).toBe(3_600_000); // would be huge; capped
  });

  it("nextRunAfter pushes run_after out by the backoff", () => {
    const now = new Date("2026-08-18T00:00:00Z");
    expect(nextRunAfter(now, 1).toISOString()).toBe("2026-08-18T00:01:00.000Z");
  });

  it("becomes terminal at MAX_PITCH_ATTEMPTS", () => {
    expect(isTerminalFailure(MAX_PITCH_ATTEMPTS - 1)).toBe(false);
    expect(isTerminalFailure(MAX_PITCH_ATTEMPTS)).toBe(true);
    expect(isTerminalFailure(MAX_PITCH_ATTEMPTS + 1)).toBe(true);
  });
});
