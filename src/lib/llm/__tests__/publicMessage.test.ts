import { describe, it, expect, vi, afterEach } from "vitest";
import { LlmError, classifyStatus, type LlmErrorKind } from "@/lib/llm/errors";
import { llmPublicMessage, LLM_PUBLIC_SENTENCES } from "@/lib/llm/publicMessage";

/**
 * Founder, 2026-09-30: a user reads our own sentence when an AI call fails; the provider's raw reply goes to the
 * logs. The error below is built with the REAL classifier and the exact message shape deepseek.ts produces.
 */
afterEach(() => vi.restoreAllMocks());

const KINDS: LlmErrorKind[] = [
  "timeout", "rate_limit", "auth", "invalid_request", "model_unavailable", "server", "network", "quota", "unknown",
];

describe("what a user reads when an AI call fails", () => {
  it("the September outage's reply becomes a sentence that names nothing internal", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = 'DeepSeek API error 402: {"error":{"message":"Insufficient Balance","type":"unknown_error"}}';
    const out = llmPublicMessage(new LlmError({ kind: classifyStatus(402), status: 402, provider: "deepseek", message: raw }));
    expect(out).not.toMatch(/DeepSeek|deepseek|402|Insufficient|\{/);
    expect(out).toBe(LLM_PUBLIC_SENTENCES.quota);
    // …and the raw reply is logged, so the people who debug it still have it.
    expect(String(spy.mock.calls[0]![0])).toContain(raw);
  });

  it("a missing key does not reveal the setting's name", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = llmPublicMessage(new LlmError({ kind: "auth", provider: "deepseek", message: "DEEPSEEK_API_KEY not set." }));
    expect(out).not.toMatch(/DEEPSEEK|API_KEY/);
  });

  it("every kind has a sentence, and none names a provider or a status code", () => {
    for (const k of KINDS) {
      const s = LLM_PUBLIC_SENTENCES[k];
      expect(s, k).toBeTruthy();
      expect(s, k).not.toMatch(/deepseek|anthropic|claude|openai|\b[45]\d\d\b/i);
    }
  });
});
