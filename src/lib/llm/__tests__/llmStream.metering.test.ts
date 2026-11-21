import { describe, it, expect, vi, beforeEach } from "vitest";

/** llmStream records each stream in the AI cost ledger once it ends (RSS Phase 0 step 6 follow-up). */
vi.mock("@/lib/env", () => ({}));
vi.mock("../usageLedger", () => ({ recordAiUsage: vi.fn(async () => undefined) }));
vi.mock("../deepseek", () => ({
  deepseekProvider: { name: "deepseek", enabled: () => true, defaultModel: () => "ds", call: vi.fn(), stream: vi.fn() },
}));
vi.mock("../anthropic", () => ({
  anthropicProvider: { name: "anthropic", enabled: () => false, defaultModel: () => "an", call: vi.fn(), stream: vi.fn() },
}));
import { deepseekProvider } from "../deepseek";
import { recordAiUsage } from "../usageLedger";
import { llmStream } from "../index";

const ARGS = { systemPrompt: "S", messages: [{ role: "user" as const, content: "hi" }], attribution: { engine: "copilot", companyId: "co1" } };

beforeEach(() => vi.clearAllMocks());

describe("llmStream metering", () => {
  it("records the usage the provider reported, under the caller's attribution, after the last token", async () => {
    vi.mocked(deepseekProvider.stream!).mockImplementation(async function* (_a, onUsage) {
      yield "a";
      yield "b";
      onUsage?.({ provider: "deepseek", model: "ds-flash", usage: { promptTokens: 10, completionTokens: 2 } });
    });
    let out = "";
    for await (const t of llmStream(ARGS)) out += t;
    expect(out).toBe("ab");
    expect(recordAiUsage).toHaveBeenCalledWith(
      { text: "", provider: "deepseek", model: "ds-flash", usage: { promptTokens: 10, completionTokens: 2 } },
      { engine: "copilot", companyId: "co1" },
    );
  });
  it("a stream that reports no usage is logged as unmetered, never recorded as free", async () => {
    vi.mocked(deepseekProvider.stream!).mockImplementation(async function* () {
      yield "x";
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for await (const _ of llmStream(ARGS)) void _;
    expect(recordAiUsage).not.toHaveBeenCalled();
    expect(String(warn.mock.calls.at(-1)?.[0])).toMatch(/not metered/);
  });
});
