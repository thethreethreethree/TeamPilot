import { describe, it, expect } from "vitest";
import { afterPitchNeedsHeal } from "../afterPitchHeal";

/**
 * Regression guard for the 2026-08-13 audit finding: a BLANK "Your read" narrative was masked by
 * the composite `hasSignal` (deterministic scores keep it true), so the auto-heal — which used to
 * key on the composite — never re-fired and the read stayed permanently blank. The heal must key on
 * the NARRATIVE's signal. The `masked-blank-read` case below is the detection test: the OLD predicate
 * (`!existing || !existing.hasSignal`) returns FALSE here, so a revert to it fails this file.
 */
describe("afterPitchNeedsHeal", () => {
  const withNarrative = (narrativeSignal: boolean, composite: boolean) => ({
    hasSignal: composite,
    narrative: { hasSignal: narrativeSignal },
  });

  it("heals when there is no stored summary at all", () => {
    expect(afterPitchNeedsHeal(null)).toBe(true);
  });

  it("heals when the composite has no signal (thin, no agent turns)", () => {
    // narrative blank AND composite false — the genuine-thin case the first clause always caught.
    expect(afterPitchNeedsHeal(withNarrative(false, false))).toBe(true);
  });

  it("heals a BLANK narrative masked by a true composite (the audit regression)", () => {
    // narrative blank but composite TRUE (deterministic scores present). The OLD composite-only
    // predicate returned false here → the read stayed blank forever. Must now heal.
    const masked = withNarrative(false, true);
    expect(afterPitchNeedsHeal(masked)).toBe(true);
    // Prove this is the case the composite-only check missed:
    const compositeOnly = !masked || !masked.hasSignal;
    expect(compositeOnly).toBe(false);
  });

  it("does NOT heal a healthy summary with a real narrative", () => {
    expect(afterPitchNeedsHeal(withNarrative(true, true))).toBe(false);
  });
});
