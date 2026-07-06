import { describe, expect, it } from "vitest";
import { classifyStatus, LlmError, type LlmErrorKind } from "../errors";
import { shouldCascade } from "../index";

describe("classifyStatus", () => {
  it("maps 401 to 'auth'", () => {
    expect(classifyStatus(401)).toBe("auth");
  });

  it("maps 429 to 'rate_limit'", () => {
    expect(classifyStatus(429)).toBe("rate_limit");
  });

  it("maps 500 to 'server'", () => {
    expect(classifyStatus(500)).toBe("server");
  });

  it("maps 408 and 504 to 'timeout'", () => {
    expect(classifyStatus(408)).toBe("timeout");
    expect(classifyStatus(504)).toBe("timeout");
  });

  it("maps 400 and 422 to 'invalid_request'", () => {
    expect(classifyStatus(400)).toBe("invalid_request");
    expect(classifyStatus(422)).toBe("invalid_request");
  });

  it("maps 403 to 'auth'", () => {
    expect(classifyStatus(403)).toBe("auth");
  });

  it("maps 402 to 'quota' (payment block, distinct from auth)", () => {
    // The load-bearing distinction: a 402 is the account, not the key — it
    // must NOT be classified as auth (different user message, and it drives
    // provider cascade).
    expect(classifyStatus(402)).toBe("quota");
  });

  it("maps other 5xx to 'server' and unmapped 4xx to 'unknown'", () => {
    expect(classifyStatus(503)).toBe("server");
    expect(classifyStatus(418)).toBe("unknown");
  });

  it("maps 200 to 'unknown'", () => {
    expect(classifyStatus(200)).toBe("unknown");
  });
});

describe("LlmError default retryable", () => {
  it("defaults retryable=true for kind 'timeout'", () => {
    const e = new LlmError({ kind: "timeout", message: "m", provider: "p" });
    expect(e.retryable).toBe(true);
  });

  it("defaults retryable=true for kind 'rate_limit'", () => {
    const e = new LlmError({ kind: "rate_limit", message: "m", provider: "p" });
    expect(e.retryable).toBe(true);
  });

  it("defaults retryable=true for kind 'network'", () => {
    const e = new LlmError({ kind: "network", message: "m", provider: "p" });
    expect(e.retryable).toBe(true);
  });

  it("defaults retryable=true for kind 'server'", () => {
    const e = new LlmError({ kind: "server", message: "m", provider: "p" });
    expect(e.retryable).toBe(true);
  });

  it("defaults retryable=false for kind 'auth'", () => {
    const e = new LlmError({ kind: "auth", message: "m", provider: "p" });
    expect(e.retryable).toBe(false);
  });

  it("defaults retryable=false for non-transient kinds (quota, invalid_request, unknown)", () => {
    for (const k of ["quota", "invalid_request", "unknown"] as const) {
      expect(
        new LlmError({ kind: k, message: "m", provider: "p" }).retryable,
        k
      ).toBe(false);
    }
  });

  it("respects an explicit retryable override on kind 'auth'", () => {
    const e = new LlmError({
      kind: "auth",
      message: "m",
      provider: "p",
      retryable: true,
    });
    expect(e.retryable).toBe(true);
  });
});

describe("shouldCascade (provider failover decision)", () => {
  const mk = (kind: LlmErrorKind) =>
    new LlmError({ kind, message: "x", provider: "p" });

  it("cascades ONLY on operator-fixable failures (auth, quota)", () => {
    expect(shouldCascade(mk("auth"))).toBe(true);
    expect(shouldCascade(mk("quota"))).toBe(true);
  });

  it("does NOT cascade on request-level / transient failures", () => {
    // Failing over would re-run the same doomed call against the other provider.
    for (const k of [
      "rate_limit",
      "invalid_request",
      "timeout",
      "network",
      "server",
      "unknown",
    ] as const) {
      expect(shouldCascade(mk(k)), k).toBe(false);
    }
  });

  it("does not cascade on a non-LlmError value", () => {
    expect(shouldCascade(new Error("boom"))).toBe(false);
    expect(shouldCascade("nope")).toBe(false);
    expect(shouldCascade(null)).toBe(false);
  });
});
