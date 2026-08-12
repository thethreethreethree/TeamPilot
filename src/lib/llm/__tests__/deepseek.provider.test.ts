import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deepseekProvider,
  withReasoningHeadroom,
  REASONING_HEADROOM_TOKENS,
  MAX_TOTAL_TOKENS,
} from "../deepseek";
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
    // caller's answer budget + the reasoning headroom (assert via the constant, not a magic number, so this
    // tracks the value; the separate floor test guards that the constant itself stays high enough).
    expect(sentBody.max_tokens).toBe(16 + REASONING_HEADROOM_TOKENS);

    await deepseekProvider.call(CALL); // no maxTokens → default 900 + headroom
    expect(sentBody.max_tokens).toBe(900 + REASONING_HEADROOM_TOKENS);
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

/**
 * Regression lock for the 2026-07-30 blank-coach-output outage. deepseek-v4-flash is a REASONING model
 * that spends completion tokens thinking BEFORE it emits content; the request budget must leave room for
 * that reasoning or the model returns finish_reason:"length" with EMPTY content. A PRIOR fix set the
 * headroom to 256 — calibrated on trivial tasks (16–34 reasoning tokens) — but complex prompts (the deep
 * dissect) reason 750–1250 tokens (measured live), so 256 starved them and "Your read" went blank for two
 * weeks. This pins a floor so a future edit can't silently drop the headroom back below what complex
 * reasoning needs.
 */
describe("reasoning-token headroom (blank-output outage guard)", () => {
  // Measured live 2026-08-06 on the REAL-SIZE review prompt (~9k-token knowledge base + full transcript):
  // reasoning ran 1300–2620 tokens, variable per run. The headroom must cover that worst case, or the tight
  // engines (debriefCoachV5 base 700) starve. A first-cut 1500 under-covered it — this floor guards against
  // that under-estimate recurring.
  const OBSERVED_COMPLEX_REASONING_MAX = 2620;

  it("headroom covers the observed complex-task reasoning with margin", () => {
    expect(REASONING_HEADROOM_TOKENS).toBeGreaterThanOrEqual(
      OBSERVED_COMPLEX_REASONING_MAX
    );
  });

  it("withReasoningHeadroom adds the full headroom on top of the caller's answer budget", () => {
    // The caller budgets maxTokens for the ANSWER; the reasoning headroom is added on top, so a 1100-token
    // dissect content budget must yield >= 1100 + the complex-reasoning floor of total room.
    expect(withReasoningHeadroom(1100) - 1100).toBeGreaterThanOrEqual(
      OBSERVED_COMPLEX_REASONING_MAX
    );
    // Undefined budget still gets a sane default plus the headroom (never below the floor).
    expect(withReasoningHeadroom(undefined)).toBeGreaterThan(
      OBSERVED_COMPLEX_REASONING_MAX
    );
  });

  it("clamps the TOTAL max_tokens to the model ceiling — a large budget + headroom can't 400 the call", () => {
    // The raised headroom (7000) + a big answer budget (dissect 1100, review 1500) would exceed the model's
    // 8192 output limit without the clamp — which would 400 EVERY deepseek call. Lock that the total never
    // exceeds MAX_TOTAL_TOKENS, and that MAX_TOTAL_TOKENS stays safely under the known 8192 model limit.
    expect(withReasoningHeadroom(1500)).toBe(MAX_TOTAL_TOKENS); // 1500 + 7000 = 8500 → clamped
    expect(withReasoningHeadroom(1100)).toBe(MAX_TOTAL_TOKENS); // 1100 + 7000 = 8100 → clamped
    expect(withReasoningHeadroom(9999)).toBe(MAX_TOTAL_TOKENS); // never above the ceiling
    expect(MAX_TOTAL_TOKENS).toBeLessThanOrEqual(8192);
    // A small live-engine budget is BELOW the clamp — it still gets the full headroom (not truncated to 8000).
    expect(withReasoningHeadroom(160)).toBe(160 + REASONING_HEADROOM_TOKENS);
  });
});

/**
 * The UNIVERSAL starvation detector: the provider logs LOUDLY whenever the model returns finish_reason:"length"
 * (reasoning ate the budget) — for EVERY engine, not just the dissect. This is the visibility that ended the
 * 2026-07-30 two-week silent outage; a regression removing it re-blinds the whole system. These lock it: it fires
 * on empty AND truncated length-responses (with completion_tokens, to size a fix), and NOT on a healthy stop.
 */
describe("deepseek starvation visibility — finish_reason:'length' logs loudly (never silent again)", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("EMPTY content + finish_reason:length → logs the starvation warning with completion_tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          choices: [{ message: { content: "" }, finish_reason: "length" }],
          usage: { prompt_tokens: 20000, completion_tokens: 8000, total_tokens: 28000 },
        })
      )
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await deepseekProvider.call(CALL);
    expect(out.text).toBe("");
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = String(spy.mock.calls[0]?.[0]);
    expect(msg).toMatch(/finish_reason.*length/);
    expect(msg).toMatch(/EMPTY content/);
    expect(msg).toMatch(/completion_tokens=8000/);
    spy.mockRestore();
  });

  it("TRUNCATED answer + finish_reason:length → logs the TRUNCATED shape (partial JSON that fails to parse)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          choices: [{ message: { content: '{"strengths": [' }, finish_reason: "length" }],
          usage: { prompt_tokens: 20000, completion_tokens: 8000, total_tokens: 28000 },
        })
      )
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await deepseekProvider.call(CALL);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/TRUNCATED answer/);
    spy.mockRestore();
  });

  it("finish_reason:stop → does NOT log (no false alarm on a healthy call)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        })
      )
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await deepseekProvider.call(CALL);
    expect(out.text).toBe('{"ok":true}');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
