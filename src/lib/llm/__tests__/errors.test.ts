import { describe, expect, it } from "vitest";
import {
  classifyStatus,
  classifyStatusWithBody,
  isModelUnavailableBody,
  LlmError,
  type LlmErrorKind,
} from "../errors";
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

  it("cascades on 'model_unavailable' (the other provider uses its own model)", () => {
    // Regression gate for the 2026-07-25 outage: DeepSeek renamed its model, the
    // 400 classified as invalid_request, shouldCascade was false → every AI tool
    // died with no failover. A bad MODEL must fail over; a bad PROMPT must not.
    expect(shouldCascade(mk("model_unavailable"))).toBe(true);
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

describe("isModelUnavailableBody (model-error vs prompt-error discrimination)", () => {
  it("matches real provider model-rejection bodies", () => {
    // The exact DeepSeek message that caused the outage.
    expect(
      isModelUnavailableBody(
        '{"error":{"message":"supported API model names are deepseek-v4-pro or deepseek-v4-flash"}}'
      )
    ).toBe(true);
    expect(isModelUnavailableBody("The model `deepseek-chat` does not exist")).toBe(
      true
    );
    expect(isModelUnavailableBody("model not found")).toBe(true);
    expect(isModelUnavailableBody("Unknown model: claude-old")).toBe(true);
    expect(isModelUnavailableBody("this model is no longer available")).toBe(true);
    expect(isModelUnavailableBody("model has been deprecated")).toBe(true);
  });

  it("does NOT match generic bad-prompt / unrelated 400 bodies", () => {
    // These are prompt-level — cascading would fail identically on the other side.
    expect(isModelUnavailableBody("messages: field required")).toBe(false);
    expect(isModelUnavailableBody("max_tokens must be positive")).toBe(false);
    expect(isModelUnavailableBody("invalid JSON in request body")).toBe(false);
    expect(isModelUnavailableBody("content policy violation")).toBe(false);
    expect(isModelUnavailableBody("")).toBe(false);
    expect(isModelUnavailableBody(null)).toBe(false);
    expect(isModelUnavailableBody(undefined)).toBe(false);
  });
});

describe("classifyStatusWithBody", () => {
  it("upgrades a model-error 400 to 'model_unavailable'", () => {
    expect(
      classifyStatusWithBody(
        400,
        "supported API model names are deepseek-v4-pro or deepseek-v4-flash"
      )
    ).toBe("model_unavailable");
  });

  it("upgrades a model-not-found 404 to 'model_unavailable'", () => {
    expect(classifyStatusWithBody(404, "model: x not found")).toBe(
      "model_unavailable"
    );
  });

  it("leaves a bad-prompt 400 as 'invalid_request'", () => {
    expect(classifyStatusWithBody(400, "messages: field required")).toBe(
      "invalid_request"
    );
  });

  it("treats a bare 404 with no model signal as 'invalid_request', not auth", () => {
    expect(classifyStatusWithBody(404, "not found")).toBe("invalid_request");
  });

  it("passes non-model statuses through unchanged", () => {
    expect(classifyStatusWithBody(401, "bad key")).toBe("auth");
    expect(classifyStatusWithBody(402, "no balance")).toBe("quota");
    expect(classifyStatusWithBody(429, "slow down")).toBe("rate_limit");
    expect(classifyStatusWithBody(500, "server model error")).toBe("server");
  });
});
