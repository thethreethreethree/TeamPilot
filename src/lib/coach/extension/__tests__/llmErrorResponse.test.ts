import { describe, it, expect, vi, afterEach } from "vitest";
import { LlmError } from "@/lib/llm/errors";
import { llmErrorResponse } from "@/lib/coach/extension/llmErrorResponse";

/**
 * The shared LlmError→HTTP mapping the 3 generative sales routes (summarize/copilot/formulate) use. Locks
 * the taxonomy in one place: rate-limit → 429, other LlmError → its status (default 502), non-LLM → a logged
 * generic 502 with the caller's fallback message.
 */

afterEach(() => vi.restoreAllMocks());

describe("llmErrorResponse", () => {
  const opts = { logTag: "coach/extension/x", fallbackMessage: "Couldn't do that right now." };

  it("maps a rate-limit LlmError to 429, carrying error + kind", async () => {
    const res = llmErrorResponse(new LlmError({ kind: "rate_limit", message: "slow down", provider: "deepseek" }), opts);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("slow down");
    expect(body.kind).toBe("rate_limit");
  });

  it("maps a non-rate-limit LlmError to its status (502 default)", () => {
    expect(llmErrorResponse(new LlmError({ kind: "server", message: "x", provider: "deepseek" }), opts).status).toBe(502);
  });

  it("honors an explicit LlmError status", () => {
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
