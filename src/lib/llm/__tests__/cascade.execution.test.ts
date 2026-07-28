import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LlmCallArgs } from "../types";
import { LlmError } from "../errors";

/**
 * Failover EXECUTION test (complements errors.test.ts, which covers only the
 * shouldCascade DECISION). Proves that when the PRIMARY provider throws a
 * cascadable error, llmCall/llmStream actually INVOKE the fallback provider and
 * return / yield its output — the behavior that "set ANTHROPIC_API_KEY and
 * failover just works" depends on, and the exact path the 2026-07-25 outage
 * exposed. A refactor that broke the fallback INVOCATION (not the decision)
 * would pass every existing test; this closes that gap.
 *
 * Both providers are mocked + enabled so chooseProvider picks deepseek (primary)
 * and otherProvider(deepseek) resolves to anthropic (fallback).
 */
vi.mock("@/lib/env", () => ({}));
vi.mock("../deepseek", () => ({
  deepseekProvider: {
    name: "deepseek",
    enabled: vi.fn(() => true),
    defaultModel: () => "deepseek-model",
    call: vi.fn(),
    stream: vi.fn(),
  },
}));
vi.mock("../anthropic", () => ({
  anthropicProvider: {
    name: "anthropic",
    enabled: vi.fn(() => true),
    defaultModel: () => "anthropic-model",
    call: vi.fn(),
    stream: vi.fn(),
  },
}));

import { deepseekProvider } from "../deepseek";
import { anthropicProvider } from "../anthropic";
import { llmCall, llmStream } from "../index";

const dsCall = vi.mocked(deepseekProvider.call);
const dsStream = vi.mocked(deepseekProvider.stream!);
const dsEnabled = vi.mocked(deepseekProvider.enabled);
const anCall = vi.mocked(anthropicProvider.call);
const anStream = vi.mocked(anthropicProvider.stream!);
const anEnabled = vi.mocked(anthropicProvider.enabled);

function args(): LlmCallArgs {
  return { systemPrompt: "BASE.", messages: [{ role: "user", content: "hi" }] };
}
const cascadable = () =>
  new LlmError({ kind: "model_unavailable", message: "model renamed", provider: "deepseek" });
const nonCascadable = () =>
  new LlmError({ kind: "invalid_request", message: "bad prompt", provider: "deepseek" });

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const t of it) out += t;
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  dsEnabled.mockReturnValue(true);
  anEnabled.mockReturnValue(true);
  delete process.env.LLM_PROVIDER; // let chooseProvider fall to deepseek.enabled()
});

describe("llmCall — failover EXECUTION", () => {
  it("primary throws a cascadable error → invokes the fallback and returns ITS result", async () => {
    dsCall.mockRejectedValueOnce(cascadable());
    anCall.mockResolvedValueOnce({ text: "from-anthropic", model: "anthropic-model", provider: "anthropic" });

    const res = await llmCall(args());

    expect(res.text).toBe("from-anthropic");
    expect(res.provider).toBe("anthropic");
    expect(dsCall).toHaveBeenCalledTimes(1); // primary was tried
    expect(anCall).toHaveBeenCalledTimes(1); // fallback was actually invoked
  });

  it("primary throws a NON-cascadable error → does NOT invoke the fallback, re-throws", async () => {
    dsCall.mockRejectedValueOnce(nonCascadable());

    await expect(llmCall(args())).rejects.toBeInstanceOf(LlmError);
    expect(anCall).not.toHaveBeenCalled(); // re-running the same doomed call is forbidden
  });

  it("cascadable error but NO fallback enabled → propagates (this is the current prod exposure)", async () => {
    anEnabled.mockReturnValue(false); // ANTHROPIC_API_KEY unset → otherProvider returns null
    dsCall.mockRejectedValueOnce(cascadable());

    await expect(llmCall(args())).rejects.toBeInstanceOf(LlmError);
    expect(anCall).not.toHaveBeenCalled();
  });
});

describe("llmStream — failover EXECUTION", () => {
  it("primary stream throws a cascadable error before yielding → yields from the fallback stream", async () => {
    dsStream.mockImplementationOnce(async function* () {
      throw cascadable();
    });
    anStream.mockImplementationOnce(async function* () {
      yield "an-";
      yield "swer";
    });

    const out = await collect(llmStream(args()));

    expect(out).toBe("an-swer");
    expect(dsStream).toHaveBeenCalledTimes(1);
    expect(anStream).toHaveBeenCalledTimes(1);
  });

  it("primary stream throws a NON-cascadable error → does NOT invoke the fallback stream", async () => {
    dsStream.mockImplementationOnce(async function* () {
      throw nonCascadable();
    });

    await expect(collect(llmStream(args()))).rejects.toBeInstanceOf(LlmError);
    expect(anStream).not.toHaveBeenCalled();
  });
});
