import { describe, it, expect } from "vitest";
import { isRetryableStatus, needsSessionRefresh, failReasonFor } from "../saveRetry";

/**
 * The Door Log save-resilience policy (founder 2026-08-21): retry a transient failure, refresh the session
 * on an expired token, and attribute an ultimate failure HONESTLY — never blame the rep's connection for a
 * server-side drop. These pure predicates are the single source the component's postDoorLog sequences.
 */

describe("saveRetry — which failures are worth retrying", () => {
  it("retries a network throw (0) and any 5xx", () => {
    expect(isRetryableStatus(0)).toBe(true); // never reached us — a momentary drop may clear
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("does NOT plain-retry a deterministic 4xx (retrying would fail identically)", () => {
    expect(isRetryableStatus(400)).toBe(false); // bad body
    expect(isRetryableStatus(401)).toBe(false); // expired token — handled by refresh, not a plain retry
    expect(isRetryableStatus(403)).toBe(false); // no company context
    expect(isRetryableStatus(429)).toBe(false); // rate-limited
  });
});

describe("saveRetry — session refresh on an expired token", () => {
  it("refreshes ONLY on a 401 (the expired-token case)", () => {
    expect(needsSessionRefresh(401)).toBe(true);
    for (const s of [0, 400, 403, 429, 500, 502]) {
      expect(needsSessionRefresh(s)).toBe(false);
    }
  });
});

describe("saveRetry — honest failure attribution (never blame the rep for our-end drops)", () => {
  it("only a request that never reached the server (0) is 'network'; every server response is 'server'", () => {
    expect(failReasonFor(0)).toBe("network"); // genuine network — the ONLY case that may mention signal
    for (const s of [401, 400, 403, 429, 500, 502, 503]) {
      // The server RESPONDED — so it's on our end, honestly attributed, never the rep's connection.
      expect(failReasonFor(s)).toBe("server");
    }
  });
});
