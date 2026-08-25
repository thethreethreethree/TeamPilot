import { describe, it, expect } from "vitest";
import {
  backoffMs,
  nextRunAfter,
  isTerminalFailure,
  isPermanentFailure,
  MAX_PITCH_ATTEMPTS,
} from "../retryBackoff";

/**
 * 5.4 — backoff schedule grows exponentially and caps; max_attempts is a terminal state.
 */
describe("pitch-processing retry backoff", () => {
  it("grows exponentially from the 7s base (2026-08-25: lowered from 30s for faster transient recovery)", () => {
    expect(backoffMs(0)).toBe(7_000); // 7s
    expect(backoffMs(1)).toBe(14_000); // 14s
    expect(backoffMs(2)).toBe(28_000); // 28s
    expect(backoffMs(3)).toBe(56_000); // 56s
    // cumulative across the 5 attempts (14+28+56+112) ≈ 3.5min, vs ~15min under the old 30s base
  });

  it("caps at the 1h ceiling instead of growing unbounded", () => {
    expect(backoffMs(20)).toBe(3_600_000); // would be huge; capped
  });

  it("nextRunAfter pushes run_after out by the backoff", () => {
    const now = new Date("2026-08-18T00:00:00Z");
    expect(nextRunAfter(now, 1).toISOString()).toBe("2026-08-18T00:00:14.000Z");
  });

  it("becomes terminal at MAX_PITCH_ATTEMPTS", () => {
    expect(isTerminalFailure(MAX_PITCH_ATTEMPTS - 1)).toBe(false);
    expect(isTerminalFailure(MAX_PITCH_ATTEMPTS)).toBe(true);
    expect(isTerminalFailure(MAX_PITCH_ATTEMPTS + 1)).toBe(true);
  });
});

/**
 * 2026-08-25 latency audit: permanent failures (bad audio content / missing config) were churning the full ~15min
 * backoff on errors that can't self-heal, inflating the after-pitch feedback average. isPermanentFailure terminalises
 * them immediately. CONSERVATIVE: a transient 5xx/timeout must NOT be classified permanent (it keeps its retries).
 */
describe("isPermanentFailure — retry cannot fix these; terminalise now", () => {
  it("is TRUE for bad audio content (a 400 content rejection)", () => {
    expect(isPermanentFailure('ElevenLabs STT failed: 400 {"code":"invalid_audio","message":"File is corrupted."}')).toBe(true);
    expect(isPermanentFailure("STT failed: invalid_content")).toBe(true);
  });
  it("is TRUE for missing account/config", () => {
    expect(isPermanentFailure("No brain row for company c3e7f389-...")).toBe(true);
    expect(isPermanentFailure("Company c3e7f389-3df6-48c8-876b-0cd4baf5c2a7 not found.")).toBe(true);
  });
  it("is FALSE for genuinely TRANSIENT errors (must keep their retries)", () => {
    expect(isPermanentFailure("ElevenLabs STT failed: 500 Internal Server Error")).toBe(false);
    expect(isPermanentFailure("fetch failed: ETIMEDOUT")).toBe(false);
    expect(isPermanentFailure("analysis returned no result (empty/malformed) — retryable")).toBe(false);
    expect(isPermanentFailure("recording stitch failed: list: timeout")).toBe(false);
  });
});
