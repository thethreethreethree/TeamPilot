import { describe, it, expect } from "vitest";
import { TONE_LAW } from "../salesReviewPrompt";

/**
 * Founder picker 2026-11-24 "Rules + cite 3 studies" (docs/rss/COACHING-WORDING-RESEARCH.md): the coaching prompt keeps
 * the three research-backed rules, names its sources, and never claims Harvard research or a praise ratio.
 */
describe("coaching wording rules from the research", () => {
  it("behaviour not person, credit what they control, the standard and the belief — with their sources", () => {
    expect(TONE_LAW).toMatch(/THE BEHAVIOR, NEVER THE PERSON/);
    expect(TONE_LAW).toMatch(/CREDIT WHAT THEY CONTROL/);
    expect(TONE_LAW).toMatch(/THE STANDARD AND THE BELIEF/);
    expect(TONE_LAW).toMatch(/Kluger & DeNisi 1996/);
    expect(TONE_LAW).toMatch(/Mueller & Dweck 1998/);
    expect(TONE_LAW).toMatch(/Yeager et al\. 2014/);
  });
  it("no Harvard claim and no fixed praise ratio", () => {
    expect(TONE_LAW).not.toMatch(/harvard/i);
    expect(TONE_LAW).not.toMatch(/\bratio\b/i); // the word, not "preparation"
  });
});
