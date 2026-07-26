import { describe, it, expect, afterEach } from "vitest";
import { chooseProvider } from "../index";

/**
 * chooseProvider — LLM_PROVIDER pin, data-governance safety.
 *
 * The pin usually exists to keep customer data on a specific provider/region (e.g. Anthropic-US, not
 * DeepSeek-China). The bug this locks: a SET-but-invalid pin (a typo, or a trailing space from the
 * hosting env UI) used to fall through to the auto-select and SILENTLY route to the other provider,
 * defeating the pin invisibly. Now: trimmed + case-insensitive, and an invalid pin FAILS LOUD.
 */

const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
});

describe("chooseProvider — LLM_PROVIDER pin", () => {
  it("honors an explicit pin, case-insensitive and trimmed", () => {
    process.env.LLM_PROVIDER = "  Anthropic  ";
    expect(chooseProvider().name).toBe("anthropic");
    process.env.LLM_PROVIDER = "DEEPSEEK";
    expect(chooseProvider().name).toBe("deepseek");
  });

  it("THROWS on a set-but-invalid pin — never silently routes to the other provider", () => {
    for (const bad of ["anthropc", "claude", "openai", "anthropic-us", "gpt4"]) {
      process.env.LLM_PROVIDER = bad;
      expect(() => chooseProvider(), `should throw for: ${bad}`).toThrow(/unrecognized/i);
    }
  });

  it("auto-selects when unset or whitespace-only (does NOT throw for empty)", () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    delete process.env.LLM_PROVIDER;
    expect(chooseProvider().name).toBe("deepseek");
    process.env.LLM_PROVIDER = "   "; // whitespace-only is treated as unset, not an invalid pin
    expect(chooseProvider().name).toBe("deepseek");
  });
});
