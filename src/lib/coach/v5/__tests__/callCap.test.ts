import { describe, it, expect } from "vitest";
import { CLOCK_GRACE_MS, MAX_CALL_MS, msUntilCap, pastCap } from "../callCap";

/** The six-hour cap (Gong F5.7). */
describe("callCap", () => {
  it("counts down from when the call went live; 0 once reached", () => {
    expect(msUntilCap(0, 3_600_000)).toBe(MAX_CALL_MS - 3_600_000);
    expect(msUntilCap(0, MAX_CALL_MS + 1)).toBe(0);
  });
  it("the server refuses only past six hours plus the clock grace, and never on an unknown start", () => {
    const start = "2026-11-27T00:00:00Z";
    const t = Date.parse(start);
    expect(pastCap(start, t + MAX_CALL_MS + CLOCK_GRACE_MS)).toBe(false);
    expect(pastCap(start, t + MAX_CALL_MS + CLOCK_GRACE_MS + 1)).toBe(true);
    expect(pastCap(null, t + 10 * MAX_CALL_MS)).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("the live recorder uses the cap (wiring)", () => {
  const src = readFileSync(join(__dirname, "../useLiveCoaching.ts"), "utf8");
  it("stops itself when the call reaches six hours and says why", () => {
    expect(src).toMatch(/msUntilCap\(callLiveAtRef\.current, Date\.now\(\)\)/);
    expect(src).toMatch(/stop\(\);\s*setError\(CALL_CAP_MESSAGE\)/);
  });
  it("a reconnect keeps the call's clock; a fresh start resets it", () => {
    expect(src).toMatch(/if \(!reconnectingRef\.current\) callLiveAtRef\.current = 0;/);
  });
});
