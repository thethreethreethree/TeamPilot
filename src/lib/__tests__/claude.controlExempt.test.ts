import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REGRESSION LOCK — controlExempt must survive the call() gate re-check (2026-08-14).
 *
 * The bug: runBrainCall correctly honors controlExempt (it RUNS the LLM and returns the real
 * text with gate.guidanceEnabled=false). But call() in claude.ts re-checked ONLY
 * `!gate.guidanceEnabled` — dropping the controlExempt term — and DISCARDED that real answer,
 * returning text:"" suppressed:true. Effect: every control-exempt Sales Coach engine
 * (review/dissect/moments/live-cue/ask-coach) returned EMPTY for any company whose §3.4
 * guidance gate was off — a 100%-empty "Your read" while still burning the LLM call. Confirmed
 * in prod: guidance=false companies were 13/13, 8/8, 6/6 empty; guidance=true companies worked
 * (the founder's "logout of Deeznuts → into an admin account → full after-pitch" A/B).
 *
 * These pin the fix at the chokepoint: with controlExempt the real text passes through even when
 * guidance is off; WITHOUT it the §3.4 control window still suppresses. Detection-verified by
 * dropping the `&& !args.controlExempt` term → the first test fails.
 */
vi.mock("server-only", () => ({}));

const runBrainCall = vi.fn();
vi.mock("@/lib/brain", () => ({ runBrainCall: (a: unknown) => runBrainCall(a) }));
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn(async () => ({ text: "direct", model: "m", provider: "p" })),
}));

import { debriefCoachV5 } from "../claude";

beforeEach(() => runBrainCall.mockReset());

describe("controlExempt bypasses the §3.4 gate re-check in call() (root of the empty 'Your read')", () => {
  it("guidance OFF + controlExempt → returns the REAL text, NOT suppressed", async () => {
    // runBrainCall ran the LLM (controlExempt) and returned real text with the gate still closed.
    runBrainCall.mockResolvedValue({
      text: '{"strengths":[]}',
      model: "deepseek",
      provider: "deepseek",
      gate: { guidanceEnabled: false },
      brainVersion: 1,
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

  it("guidance OFF + NOT exempt → still suppressed (the §3.4 control window holds)", async () => {
    // runBrainCall suppressed: it did NOT run the LLM (non-exempt, gate closed).
    runBrainCall.mockResolvedValue({
      text: "",
      model: "(suppressed)",
      provider: "(suppressed)",
      gate: { guidanceEnabled: false, reason: "control window" },
      brainVersion: 1,
    });
    const r = await debriefCoachV5({
      companyId: "elostate-diag",
      systemPrompt: "S",
      userMessage: "U",
    });
    expect(r.suppressed).toBe(true);
    expect(r.text).toBe("");
  });

  it("guidance ON → returns the real text regardless of exemption", async () => {
    runBrainCall.mockResolvedValue({
      text: "REAL",
      model: "deepseek",
      provider: "deepseek",
      gate: { guidanceEnabled: true },
      brainVersion: 1,
    });
    const r = await debriefCoachV5({ companyId: "moses-admin", systemPrompt: "S", userMessage: "U" });
    expect(r.suppressed).toBe(false);
    expect(r.text).toBe("REAL");
  });
});
