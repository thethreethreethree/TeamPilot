import { describe, it, expect } from "vitest";
import { buildLiveCueSystemPrompt } from "../liveCuePrompt";

/**
 * Part 2 wiring lock (founder 2026-07-30): the client's objection rules must reach the live-cue prompt.
 * These pin that buildLiveCueSystemPrompt injects the objection block when guidance is present and omits
 * it when it isn't — so a regression that drops the block (reverting objection coaching to generic) fails.
 */
describe("live-cue objection block", () => {
  it("injects the team's own objection rules verbatim when present", () => {
    const prompt = buildLiveCueSystemPrompt("guide_response", {
      objectionGuidance: "When they say too expensive, reframe to value-per-day; never argue price.",
    });
    expect(prompt).toContain("reframe to value-per-day");
    expect(prompt).toMatch(/objection rules/i);
    expect(prompt).toMatch(/not generic tactics/i);
  });

  it("omits the objection block entirely when there is no objection guidance", () => {
    const prompt = buildLiveCueSystemPrompt("guide_response", {
      methodology: "Ask discovery questions before pitching.",
    });
    expect(prompt).not.toMatch(/THIS TEAM'S OWN objection rules/i);
  });

  it("works in both cue modes", () => {
    for (const mode of ["guide_response", "suggestion"] as const) {
      const prompt = buildLiveCueSystemPrompt(mode, { objectionGuidance: "acknowledge first, then ask one question" });
      expect(prompt).toContain("acknowledge first");
    }
  });
});
