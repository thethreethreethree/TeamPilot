import { describe, it, expect, vi, afterEach } from "vitest";
import { LlmError } from "@/lib/llm/errors";
import { llmErrorResponse } from "@/lib/coach/extension/llmErrorResponse";

/**
 * The shared LlmError→HTTP mapping the 3 generative sales routes (summarize/copilot/formulate) use. Locks
 * the taxonomy in one place: rate-limit → 429, other LlmError → its status (default 502), non-LLM → a logged
 * generic 502 with the caller's fallback message.
 *
 * Load-bearing security contract (CWE-209): the client must NEVER receive err.message, because the provider
 * layer builds it from raw upstream text (e.g. "DeepSeek API error 400: <body>") that leaks the AI vendor
 * and upstream error body. The response error is always the caller's generic fallbackMessage; the real cause
 * is logged server-side. These tests assert that, and would fail if the helper regressed to returning
 * err.message (the pre-fix behavior).
 */

afterEach(() => vi.restoreAllMocks());

describe("llmErrorResponse", () => {
  const opts = { logTag: "coach/extension/x", fallbackMessage: "Couldn't do that right now." };

  it("maps a rate-limit LlmError to 429 with the GENERIC message (never err.message) + the safe kind", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = llmErrorResponse(new LlmError({ kind: "rate_limit", message: "slow down", provider: "deepseek" }), opts);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Couldn't do that right now.");
    expect(body.kind).toBe("rate_limit");
    expect(spy).toHaveBeenCalled(); // the real cause is logged server-side, not dropped
  });

  it("never leaks raw provider text to the client (CWE-209)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // A real DeepSeek 400 message: vendor name + raw upstream body. None of it may reach the client.
    const leaky = new LlmError({
      kind: "server",
      message: "DeepSeek API error 400: {\"error\":\"internal detail\"}",
      provider: "deepseek",
      rawBody: "{\"error\":\"internal detail\"}",
    });
    const body = await llmErrorResponse(leaky, opts).json();
    expect(body.error).toBe("Couldn't do that right now.");
    expect(JSON.stringify(body)).not.toContain("DeepSeek");
    expect(JSON.stringify(body)).not.toContain("internal detail");
    // ...but the operator still gets it in the logs.
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[coach/extension/x] LLM error kind=server provider=deepseek"),
      expect.stringContaining("DeepSeek API error 400"),
      expect.stringContaining("internal detail")
    );
  });

  it("maps a non-rate-limit LlmError to its status (502 default)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(llmErrorResponse(new LlmError({ kind: "server", message: "x", provider: "deepseek" }), opts).status).toBe(502);
  });

  it("honors an explicit LlmError status", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      llmErrorResponse(new LlmError({ kind: "server", message: "x", provider: "deepseek", status: 503 }), opts).status
    ).toBe(503);
  });

  it("maps a non-LLM error to a logged generic 502 with the fallback message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = llmErrorResponse(new Error("boom"), opts);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Couldn't do that right now.");
    expect(spy).toHaveBeenCalledWith("[coach/extension/x] non-LLM failure:", expect.any(Error));
  });
});
