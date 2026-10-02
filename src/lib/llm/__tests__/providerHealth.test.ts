import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deepseekProvider } from "../deepseek";
import { LlmError, isProviderOutage } from "../errors";
import {
  OPEN_AFTER,
  OPEN_MS,
  _resetProviderHealth,
  assertProviderAvailable,
  recordProviderResult,
} from "../providerHealth";

/**
 * FAIL FAST WHILE THE PROVIDER IS DOWN (2026-10-02). On 2026-10-01 DeepSeek stopped answering for hours and every
 * AI call waited out its 45 s timeout. Founder, picker 2026-10-02: "DeepSeek only, fail fast".
 */
const timeout = () => new LlmError({ kind: "timeout", provider: "deepseek", message: "timed out", retryable: false });
const CALL = { systemPrompt: "s", messages: [{ role: "user" as const, content: "hi" }] };

function thrown(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}

beforeEach(() => _resetProviderHealth());

describe("the breaker", () => {
  it(`stays closed after one outage failure, opens after ${OPEN_AFTER}`, () => {
    recordProviderResult("deepseek", timeout(), 0);
    expect(thrown(() => assertProviderAvailable("deepseek", 1))).toBeNull();
    recordProviderResult("deepseek", timeout(), 2);
    const e = thrown(() => assertProviderAvailable("deepseek", 3));
    expect(e).toBeInstanceOf(LlmError);
    expect((e as LlmError).kind).toBe("server");
    // The skip is itself an outage verdict, so the pitch worker defers on it (§2.2: one verdict, two consumers).
    expect(isProviderOutage(e)).toBe(true);
  });

  it("a success in between resets the count: one slow call among good ones never opens it", () => {
    recordProviderResult("deepseek", timeout(), 0);
    recordProviderResult("deepseek", null, 1);
    recordProviderResult("deepseek", timeout(), 2);
    expect(thrown(() => assertProviderAvailable("deepseek", 3))).toBeNull();
  });

  it.each([
    ["auth", 401],
    ["quota", 402],
    ["invalid_request", 400],
    ["model_unavailable", 400],
    ["rate_limit", 429],
  ] as const)("a %s error is the account or the request, not an outage: never counted", (kind, status) => {
    for (let i = 0; i < OPEN_AFTER + 2; i++) {
      recordProviderResult("deepseek", new LlmError({ kind, status, provider: "deepseek", message: "x" }), i);
    }
    expect(thrown(() => assertProviderAvailable("deepseek", 10))).toBeNull();
  });

  it("lets one probe through after OPEN_MS; another failure reopens it at once, a success closes it", () => {
    for (let i = 0; i < OPEN_AFTER; i++) recordProviderResult("deepseek", timeout(), 0);
    expect(thrown(() => assertProviderAvailable("deepseek", OPEN_MS - 1))).not.toBeNull();
    expect(thrown(() => assertProviderAvailable("deepseek", OPEN_MS))).toBeNull(); // the probe
    recordProviderResult("deepseek", timeout(), OPEN_MS + 1); // probe failed
    expect(thrown(() => assertProviderAvailable("deepseek", OPEN_MS + 2))).not.toBeNull();
    recordProviderResult("deepseek", null, 3 * OPEN_MS); // a later probe succeeded
    expect(thrown(() => assertProviderAvailable("deepseek", 3 * OPEN_MS + 1))).toBeNull();
  });

  it("is per provider", () => {
    for (let i = 0; i < OPEN_AFTER; i++) recordProviderResult("deepseek", timeout(), 0);
    expect(thrown(() => assertProviderAvailable("anthropic", 1))).toBeNull();
  });
});

describe("wired into the DeepSeek provider", () => {
  // What a hung provider looks like to fetchWithTimeout: the AbortController fires and fetch rejects.
  const hang = () => vi.fn(async () => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })));

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
  });

  it(`after ${OPEN_AFTER} timeouts the next call fails WITHOUT a request`, async () => {
    const f = hang();
    vi.stubGlobal("fetch", f);
    for (let i = 0; i < OPEN_AFTER; i++) {
      await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "timeout" });
    }
    expect(f).toHaveBeenCalledTimes(OPEN_AFTER);
    await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "server" });
    expect(f).toHaveBeenCalledTimes(OPEN_AFTER); // no request made: failed in no time, not 45 s
  });

  it("streaming calls share the same memory", async () => {
    const f = hang();
    vi.stubGlobal("fetch", f);
    for (let i = 0; i < OPEN_AFTER; i++) {
      await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "timeout" });
    }
    const drain = async () => {
      for await (const _ of deepseekProvider.stream!(CALL)) void _;
    };
    await expect(drain()).rejects.toMatchObject({ kind: "server" });
    expect(f).toHaveBeenCalledTimes(OPEN_AFTER);
  });

  it("a streaming connect timeout counts toward opening it", async () => {
    const f = hang();
    vi.stubGlobal("fetch", f);
    const drain = async () => {
      for await (const _ of deepseekProvider.stream!(CALL)) void _;
    };
    for (let i = 0; i < OPEN_AFTER; i++) await expect(drain()).rejects.toMatchObject({ kind: "timeout" });
    await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "server" });
    expect(f).toHaveBeenCalledTimes(OPEN_AFTER);
  });

  it("a successful call clears a failure, so the next failure does not open it", async () => {
    vi.stubGlobal("fetch", hang());
    await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "timeout" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }))
    );
    await expect(deepseekProvider.call(CALL)).resolves.toMatchObject({ text: "ok" });
    const f = hang();
    vi.stubGlobal("fetch", f);
    await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "timeout" });
    await expect(deepseekProvider.call(CALL)).rejects.toMatchObject({ kind: "timeout" });
    expect(f).toHaveBeenCalledTimes(2); // both reached DeepSeek
  });
});
