import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LlmCallArgs } from "../types";

/**
 * Integration test for the central Experience Mode injection (0110 Phase 2):
 * proves llmCall/llmStream actually append the Standard directive to the system
 * prompt the PROVIDER receives — the wiring the pure shapeSystemPrompt unit test
 * (mode.test.ts) does not cover. Mocks both providers + env so no network/key.
 */
vi.mock("@/lib/env", () => ({}));
vi.mock("../anthropic", () => ({
  anthropicProvider: { name: "anthropic", enabled: () => false },
}));
vi.mock("../deepseek", () => ({
  deepseekProvider: {
    name: "deepseek",
    enabled: () => true,
    call: vi.fn(async () => ({ text: "ok", model: "m", provider: "deepseek" })),
    stream: vi.fn(async function* () {
      yield "ok";
    }),
  },
}));

import { deepseekProvider } from "../deepseek";
import { llmCall, llmStream } from "../index";

const call = vi.mocked(deepseekProvider.call);
const stream = vi.mocked(deepseekProvider.stream!);

function args(over: Partial<LlmCallArgs>): LlmCallArgs {
  return {
    systemPrompt: "BASE PROMPT.",
    messages: [{ role: "user", content: "hi" }],
    ...over,
  };
}

beforeEach(() => {
  call.mockClear();
  stream.mockClear();
  delete process.env.LLM_PROVIDER; // let chooseProvider fall to deepseek.enabled()
});

describe("llmCall — Experience Mode injection", () => {
  it("appends the Standard directive to the provider's systemPrompt (prose)", async () => {
    await llmCall(args({ experienceMode: "standard", expectJson: false }));
    const got = call.mock.calls[0]![0] as LlmCallArgs;
    expect(got.systemPrompt.startsWith("BASE PROMPT.")).toBe(true);
    expect(got.systemPrompt).toContain("STANDARD");
  });

  it("does NOT append for a Standard expectJson call (JSON-safety — parse must not break)", async () => {
    await llmCall(args({ experienceMode: "standard", expectJson: true }));
    const got = call.mock.calls[0]![0] as LlmCallArgs;
    expect(got.systemPrompt).toBe("BASE PROMPT.");
  });

  it("leaves the prompt unchanged for expert", async () => {
    await llmCall(args({ experienceMode: "expert" }));
    const got = call.mock.calls[0]![0] as LlmCallArgs;
    expect(got.systemPrompt).toBe("BASE PROMPT.");
  });

  it("leaves the prompt unchanged when no mode is threaded", async () => {
    await llmCall(args({}));
    const got = call.mock.calls[0]![0] as LlmCallArgs;
    expect(got.systemPrompt).toBe("BASE PROMPT.");
  });
});

describe("llmStream — Experience Mode injection", () => {
  it("appends the Standard directive to the streamed provider's systemPrompt (prose)", async () => {
    // drain the async iterable
    for await (const _ of llmStream(
      args({ experienceMode: "standard", expectJson: false })
    )) {
      void _;
    }
    const got = stream.mock.calls[0]![0] as LlmCallArgs;
    expect(got.systemPrompt).toContain("STANDARD");
  });

  it("does NOT append for a Standard expectJson stream", async () => {
    for await (const _ of llmStream(
      args({ experienceMode: "standard", expectJson: true })
    )) {
      void _;
    }
    const got = stream.mock.calls[0]![0] as LlmCallArgs;
    expect(got.systemPrompt).toBe("BASE PROMPT.");
  });
});
