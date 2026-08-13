import { describe, it, expect } from "vitest";
import { detectCaptureGap, afterPitchNeedsAutoRecover } from "../captureGap";

/**
 * captureGap — pins the detection that drives automatic recovery. The regression that
 * matters most: the founder's 2026-08-14 session (agent captured, customer missing →
 * talk_ratio caveat, scores.length === 2) MUST classify as "customer-missing", not as a
 * healthy call. A `scores.length === 0` gate got this wrong; this test locks the fix.
 */

const talkCaveat = { key: "talk_ratio", caveat: true };
const questionRate = { key: "question_rate" };
const talkReal = { key: "talk_ratio" };

describe("detectCaptureGap", () => {
  it("customer-missing: talk_ratio caveat present (the founder's scores.length===2 shape)", () => {
    const summary = {
      narrative: { hasSignal: false },
      scores: [talkCaveat, questionRate], // length 2, agent turns present
    };
    expect(detectCaptureGap(summary)).toBe("customer-missing");
  });

  it("agent-missing: no scores + blank narrative (0 agent turns)", () => {
    expect(
      detectCaptureGap({ narrative: { hasSignal: false }, scores: [] })
    ).toBe("agent-missing");
  });

  it("null: healthy two-sided call (real talk ratio, narrative present)", () => {
    expect(
      detectCaptureGap({ narrative: { hasSignal: true }, scores: [talkReal, questionRate] })
    ).toBeNull();
  });

  it("null: a thin-but-two-sided call (real talk ratio, blank narrative = starved, not a capture gap)", () => {
    // Both sides captured (no caveat) but the LLM read came back empty. Re-transcribe
    // won't help → NOT a capture gap; the silent auto-heal owns this.
    expect(
      detectCaptureGap({ narrative: { hasSignal: false }, scores: [talkReal, questionRate] })
    ).toBeNull();
  });
});

describe("afterPitchNeedsAutoRecover", () => {
  const customerMissing = {
    narrative: { hasSignal: false },
    scores: [talkCaveat, questionRate],
  };

  it("fires for customer-missing WITH saved audio", () => {
    expect(afterPitchNeedsAutoRecover(customerMissing, true)).toBe(true);
  });

  it("does NOT fire without saved audio (nothing to re-transcribe)", () => {
    expect(afterPitchNeedsAutoRecover(customerMissing, false)).toBe(false);
  });

  it("does NOT fire for a healthy call", () => {
    expect(
      afterPitchNeedsAutoRecover(
        { narrative: { hasSignal: true }, scores: [talkReal, questionRate] },
        true
      )
    ).toBe(false);
  });

  it("does NOT fire for agent-missing (out of scope — the whole-empty path owns it)", () => {
    expect(
      afterPitchNeedsAutoRecover({ narrative: { hasSignal: false }, scores: [] }, true)
    ).toBe(false);
  });

  it("does NOT fire on a null summary", () => {
    expect(afterPitchNeedsAutoRecover(null, true)).toBe(false);
  });
});
