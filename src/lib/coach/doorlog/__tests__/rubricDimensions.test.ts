import { describe, it, expect } from "vitest";
import { RUBRIC_DIMENSIONS, ANALYSIS_PROMPT_VERSION } from "../analyze";

/**
 * Locks the door-to-door pitch rubric to the founder's 2026-08-19 spec (the Today's-Metrics Score Chart grades
 * these five). Opener was dropped; talk_listen + questions were added. A silent revert would change what the
 * Score Chart shows and re-mismatch the analysis prompt, so this pins the set + order + the version bump.
 */
describe("door-to-door pitch rubric (founder spec 2026-08-19)", () => {
  it("grades exactly objection / talk_listen / questions / tone / close", () => {
    expect([...RUBRIC_DIMENSIONS]).toEqual(["objection", "talk_listen", "questions", "tone", "close"]);
  });

  it("no longer includes the dropped 'opener' dimension", () => {
    expect(RUBRIC_DIMENSIONS as readonly string[]).not.toContain("opener");
  });

  it("carries the v2 prompt version (the rubric changed, so provenance must too)", () => {
    expect(ANALYSIS_PROMPT_VERSION).toBe("doorlog-analysis-v2");
  });
});
