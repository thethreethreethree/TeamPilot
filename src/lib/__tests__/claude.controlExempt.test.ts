import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REGRESSION LOCK — call() must CONSUME runBrainCall's `suppressed` verdict, not re-derive the gate
 * (CLAUDE.md §2.2 / AMD-010 / A40, 2026-08-14).
 *
 * The bug: runBrainCall correctly honored controlExempt (ran the LLM, returned the real text), but call()
 * re-derived the §3.4 decision itself and checked `!gate.guidanceEnabled` ALONE — dropping the controlExempt
 * term — and DISCARDED the real answer. Effect: every control-exempt engine (review/dissect/moments/live-cue/
 * ask-coach) returned EMPTY for any company with guidance off — 100% empty "Your read" while still burning the
 * LLM call (prod: guidance=false companies 13/13, 8/8, 6/6 empty; guidance=true worked). The durable fix
 * (AMD-010 R1): runBrainCall returns an explicit `suppressed` verdict and call() branches on THAT — the gate
 * decision now lives in exactly one place and cannot drift.
 *
 * These pin the contract: call() returns the real text iff runBrainCall did NOT suppress. Detection-verified
 * by making call() ignore `r.suppressed` (re-derive the gate) → these fail. The controlExempt LOGIC itself is
 * tested at the authority in runBrainCall.gate.test.ts / runBrainStream.gate.test.ts.
 */
vi.mock("server-only", () => ({}));

const runBrainCall = vi.fn();
vi.mock("@/lib/brain", () => ({ runBrainCall: (a: unknown) => runBrainCall(a) }));
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn(async () => ({ text: "direct", model: "m", provider: "p" })),
}));

import { debriefCoachV5 } from "../claude";

beforeEach(() => runBrainCall.mockReset());

describe("call() consumes runBrainCall's suppressed verdict (root of the empty 'Your read')", () => {
  it("authority did NOT suppress (controlExempt ran the LLM) → returns the REAL text", async () => {
    // runBrainCall, given controlExempt, ran the LLM and returned suppressed:false with the gate still closed.
    runBrainCall.mockResolvedValue({
      text: '{"strengths":[]}',
      model: "deepseek",
      provider: "deepseek",
      gate: { guidanceEnabled: false },
      brainVersion: 1,
      suppressed: false,
    });
    const r = await debriefCoachV5({
      companyId: "deeznuts",
      systemPrompt: "S",
      userMessage: "U",
      controlExempt: true,
    });
    expect(r.suppressed).toBe(false);
    expect(r.text).toBe('{"strengths":[]}'); // the real answer is NOT discarded
  });

  it("authority suppressed (non-exempt, control window) → call() reports suppressed + empty", async () => {
    runBrainCall.mockResolvedValue({
      text: "",
      model: "(suppressed)",
      provider: "(suppressed)",
      gate: { guidanceEnabled: false, reason: "control window" },
      brainVersion: 1,
      suppressed: true,
    });
    const r = await debriefCoachV5({
      companyId: "elostate-diag",
      systemPrompt: "S",
      userMessage: "U",
    });
    expect(r.suppressed).toBe(true);
    expect(r.text).toBe("");
  });

  it("guidance ON (not suppressed) → returns the real text", async () => {
    runBrainCall.mockResolvedValue({
      text: "REAL",
      model: "deepseek",
      provider: "deepseek",
      gate: { guidanceEnabled: true },
      brainVersion: 1,
      suppressed: false,
    });
    const r = await debriefCoachV5({ companyId: "moses-admin", systemPrompt: "S", userMessage: "U" });
    expect(r.suppressed).toBe(false);
    expect(r.text).toBe("REAL");
  });
});
