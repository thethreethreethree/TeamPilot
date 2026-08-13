import { describe, it, expect } from "vitest";
import { afterPitchNeedsHeal } from "../afterPitchHeal";

/**
 * Regression guard for the 2026-08-13 audit finding AND the follow-up convergence fix:
 *
 *  - A BLANK "Your read" narrative masked by the composite `hasSignal` (deterministic scores keep it true)
 *    must re-heal when the read is RECOVERABLE (agent turns present → scores present → a starved read).
 *  - But it must NOT re-heal a STRUCTURALLY-blank narrative — a one-sided / customer-only recording (0 agent
 *    turns → scores EMPTY, narrative deterministically blank) whose composite is kept true by moments/cueLoop.
 *    Healing that case re-fires a full generation on every mount and never converges. This is the exact
 *    regression an adversarial review caught: `moments` (any-speaker) and `cueLoop` (transcript-independent)
 *    drive the composite independently of agent turns, so "scores ⟺ agent turns" is the gate, not the composite.
 */
describe("afterPitchNeedsHeal", () => {
  const summary = (opts: {
    narrativeSignal: boolean;
    composite: boolean;
    scores: number; // count of score categories present
  }) => ({
    hasSignal: opts.composite,
    narrative: { hasSignal: opts.narrativeSignal },
    scores: Array.from({ length: opts.scores }, (_, i) => i),
  });

  it("heals when there is no stored summary at all", () => {
    expect(afterPitchNeedsHeal(null)).toBe(true);
  });

  it("heals when the composite has no signal (thin, no agent turns)", () => {
    expect(afterPitchNeedsHeal(summary({ narrativeSignal: false, composite: false, scores: 0 }))).toBe(true);
  });

  it("heals a STARVED read: blank narrative masked by a true composite, WITH scores (agent turns present)", () => {
    // The recoverable case — agent turns → scores present, but the reasoning model returned an empty read.
    const starved = summary({ narrativeSignal: false, composite: true, scores: 2 });
    expect(afterPitchNeedsHeal(starved)).toBe(true);
    // Prove this is the case the ORIGINAL composite-only predicate missed:
    expect(!starved || !starved.hasSignal).toBe(false);
  });

  it("does NOT heal a one-sided recording: blank narrative + composite true but NO scores (0 agent turns)", () => {
    // THE CONVERGENCE REGRESSION: composite true via moments/cueLoop, narrative deterministically blank,
    // scores empty (0 agent turns). salesReview can never produce a read here → healing would loop forever.
    const oneSided = summary({ narrativeSignal: false, composite: true, scores: 0 });
    expect(afterPitchNeedsHeal(oneSided)).toBe(false);
    // And prove the naive narrative-only check WOULD have looped on it:
    const narrativeOnlyCheck = !oneSided.narrative.hasSignal; // the pre-fix trigger
    expect(narrativeOnlyCheck).toBe(true);
  });

  it("does NOT heal a healthy summary with a real narrative", () => {
    expect(afterPitchNeedsHeal(summary({ narrativeSignal: true, composite: true, scores: 2 }))).toBe(false);
  });
});
