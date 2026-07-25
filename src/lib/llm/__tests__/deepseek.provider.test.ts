import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deepseekProvider } from "../deepseek";
import { LlmError } from "../errors";
import { shouldCascade } from "../index";

/**
 * Provider-level regression lock for the 2026-07-25 outage: DeepSeek renamed its
 * model, returned HTTP 400 "supported API model names are …", and because that
 * classified as invalid_request (which doesn't cascade) EVERY AI tool went down.
 *
 * classifyStatusWithBody is unit-tested in isolation (errors.test.ts); this test
 * pins the WIRING — that the DeepSeek provider actually routes a model-error 400
 * to `model_unavailable` (so the cascade fires) and a bad-PROMPT 400 to
 * `invalid_request` (so it does NOT). Reverting deepseek.ts to classifyStatus
 * would fail here.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CALL = {
  systemPrompt: "You are a helper.",
  messages: [{ role: "user" as const, content: "hi" }],
};

describe("deepseekProvider error classification (outage regression lock)", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("maps the real model-rename 400 to 'model_unavailable' AND it cascades", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, {
          error: {
            message:
              "supported API model names are deepseek-v4-pro or deepseek-v4-flash",
          },
        })
      )
    );

    let caught: unknown;
    try {
      await deepseekProvider.call(CALL);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LlmError);
    expect((caught as LlmError).kind).toBe("model_unavailable");
    // The load-bearing consequence: this failure MUST fail over to the other provider.
    expect(shouldCascade(caught)).toBe(true);
  });

  it("maps a bad-PROMPT 400 to 'invalid_request' and does NOT cascade", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, { error: { message: "messages: field required" } })
      )
    );

    let caught: unknown;
    try {
      await deepseekProvider.call(CALL);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LlmError);
    expect((caught as LlmError).kind).toBe("invalid_request");
    expect(shouldCascade(caught)).toBe(false);
  });

  it("adds reasoning headroom to max_tokens (rescues tight caps on the reasoning model)", async () => {
    // Verified live 2026-07-25: v4-flash counts reasoning_content against max_tokens,
    // so a tiny cap (classifyTurnSpeaker=16) spends the whole budget on reasoning and
    // returns EMPTY. The provider adds headroom so the ANSWER survives. This pins that
    // the sent body carries caller-cap + headroom, not the bare cap.
    let sentBody: { max_tokens?: number } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sentBody = JSON.parse(init.body);
        return jsonResponse(200, {
          choices: [{ message: { content: '{"speaker":"prospect"}' } }],
          usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
        });
      })
    );

    await deepseekProvider.call({ ...CALL, maxTokens: 16 });
    // 16 (caller's answer budget) + 256 headroom.
    expect(sentBody.max_tokens).toBe(272);

    await deepseekProvider.call(CALL); // no maxTokens → default 900 + headroom
    expect(sentBody.max_tokens).toBe(1156);
  });

  it("still maps 401 to 'auth' (cascades) — non-model failures unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { error: { message: "bad key" } }))
    );

    let caught: unknown;
    try {
      await deepseekProvider.call(CALL);
    } catch (e) {
      caught = e;
    }
    expect((caught as LlmError).kind).toBe("auth");
    expect(shouldCascade(caught)).toBe(true);
  });
});
