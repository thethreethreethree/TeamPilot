import { describe, expect, it } from "vitest";
import { decideCueDelivery } from "../cueDelivery";

const base = {
  shouldCue: true,
  hasCue: true,
  importance: "medium" as const,
  onDemand: false,
};

describe("decideCueDelivery — the single-best-cue gate (§3.3)", () => {
  it("delivers a medium/high cue that passed the engine gate", () => {
    expect(decideCueDelivery(base)).toEqual({ deliver: true });
    expect(decideCueDelivery({ ...base, importance: "high" })).toEqual({ deliver: true });
  });

  it("SUPPRESSES a low-importance cue (don't dilute the signal)", () => {
    expect(decideCueDelivery({ ...base, importance: "low" })).toEqual({
      deliver: false,
      suppressReason: "low-importance",
    });
  });

  it("does not deliver when the engine said stay silent", () => {
    expect(decideCueDelivery({ ...base, shouldCue: false })).toEqual({
      deliver: false,
      suppressReason: "gate",
    });
    expect(decideCueDelivery({ ...base, hasCue: false })).toEqual({
      deliver: false,
      suppressReason: "gate",
    });
  });

  it("on-demand (rep asked) always delivers a non-empty cue, even low importance", () => {
    expect(
      decideCueDelivery({ ...base, onDemand: true, importance: "low" })
    ).toEqual({ deliver: true });
  });

  it("on-demand with no cue text reports empty, not a silent drop", () => {
    expect(
      decideCueDelivery({ ...base, onDemand: true, hasCue: false, shouldCue: false })
    ).toEqual({ deliver: false, suppressReason: "empty" });
  });
});
