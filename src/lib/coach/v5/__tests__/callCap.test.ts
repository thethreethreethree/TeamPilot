import { describe, it, expect } from "vitest";
import { MAX_CALL_CHUNK, MAX_CALL_MS, msUntilCap, pastCapChunk } from "../callCap";

/** The six-hour cap (Gong F5.7). */
describe("callCap", () => {
  it("counts down from when the call went live; 0 once reached", () => {
    expect(msUntilCap(0, 3_600_000)).toBe(MAX_CALL_MS - 3_600_000);
    expect(msUntilCap(0, MAX_CALL_MS + 1)).toBe(0);
  });
  it("the server refuses by chunk number: six hours of 15-second chunks plus 15 minutes, no clock involved", () => {
    expect(MAX_CALL_CHUNK).toBe(1500);
    expect(pastCapChunk(1500)).toBe(false);
    expect(pastCapChunk(1501)).toBe(true);
  });

});

import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("the live recorder uses the cap (wiring)", () => {
  const src = readFileSync(join(__dirname, "../useLiveCoaching.ts"), "utf8");
  it("stops itself when the call has recorded six hours and says why; armed on the recorder, not on 'live'", () => {
    expect(src).toMatch(/if \(!audioCapturing\) return;/);
    expect(src).toMatch(/msUntilCap\(callLiveAtRef\.current, Date\.now\(\)\)/);
    expect(src).toMatch(/stop\(\);\s*setError\(CALL_CAP_MESSAGE\)/);
  });
  it("a reconnect keeps the call's clock; a fresh start resets it", () => {
    expect(src).toMatch(/if \(!reconnectingRef\.current\) callLiveAtRef\.current = 0;/);
  });
});

describe("the meeting recorder uses the cap too (wiring)", () => {
  const src = readFileSync(join(__dirname, "../useMeetingCoaching.ts"), "utf8");
  it("stops a meeting at six hours, counted from its fresh start", () => {
    expect(src).toMatch(/msUntilCap\(meetingStartedAtRef\.current, Date\.now\(\)\)/);
    expect(src).toMatch(/meetingStartedAtRef\.current = 0; \/\/ a fresh meeting/);
  });
});

