import { describe, expect, it } from "vitest";
import { classifyStatus, LlmError } from "../errors";

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
