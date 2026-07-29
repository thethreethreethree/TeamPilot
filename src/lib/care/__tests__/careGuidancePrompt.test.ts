import { describe, it, expect } from "vitest";
import { buildCareSystemPrompt } from "../prompt";

/**
 * Jeff customer-assistance guidance wiring (founder 2026-07-30). Pins that the business's own guidance
 * reaches Jeff's system prompt — scoped within his core rules — and is absent when unset. A regression
 * that drops the block reverts Jeff to generic behavior on every reply.
 */
describe("buildCareSystemPrompt — assistance guidance", () => {
  it("injects the guidance verbatim, scoped within the core identity/honesty rules", () => {
    const p = buildCareSystemPrompt({
      assistanceGuidance: "Always acknowledge frustration first, then offer a refund within 30 days.",
    });
    expect(p).toContain("offer a refund within 30 days");
    expect(p).toMatch(/HOW TO ASSIST/i);
    expect(p).toMatch(/within your core identity and honesty rules/i);
    // Hardening: guidance can NOT weaken Jeff's honesty rules — the precedence is explicit.
    expect(p).toMatch(/your core rules WIN/i);
    expect(p).toMatch(/pretend to be human|hide that you'?re an AI/i);
  });

  it("omits the block entirely when there is no guidance", () => {
    const p = buildCareSystemPrompt({ productContext: "We sell widgets." });
    expect(p).not.toMatch(/HOW TO ASSIST/i);
  });

  it("trims and skips whitespace-only guidance", () => {
    const p = buildCareSystemPrompt({ assistanceGuidance: "   \n  " });
    expect(p).not.toMatch(/HOW TO ASSIST/i);
  });
});
