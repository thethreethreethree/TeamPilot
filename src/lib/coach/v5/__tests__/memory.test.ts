import { describe, it, expect } from "vitest";
import { renderMemoryForPrompt } from "../memory";
import type { CoachMemorySnapshot } from "../memory";

/**
 * renderMemoryForPrompt (§1.6 close-the-loop-on-itself + §3.6 make-learning-visible). The load-bearing property
 * is an HONESTY threshold (§3.4): below a minimum history it returns null — "better silent than wrong; the LLM
 * should treat this user as new rather than hallucinate patterns from sparse data." Above it, it renders the
 * prior-coaching patterns + grade mix. The pure render fn was untested (the module read as IO-heavy because of
 * loadCoachMemory).
 */

const snap = (over: Partial<CoachMemorySnapshot> = {}): CoachMemorySnapshot => ({
  totalAnalyses: 0,
  patterns: [],
  recentGradeMix: { productive: 0, neutral: 0, needsGuidance: 0 },
  totalGraded: 0,
  ...over,
});

describe("renderMemoryForPrompt — the honesty threshold (§3.4)", () => {
  it("returns null on sparse history (better silent than hallucinate patterns)", () => {
    expect(renderMemoryForPrompt(snap({ totalAnalyses: 2, totalGraded: 4 }))).toBeNull();
    expect(renderMemoryForPrompt(snap())).toBeNull();
  });

  it("renders once EITHER threshold is met (>=3 analyses OR >=5 graded)", () => {
    expect(renderMemoryForPrompt(snap({ totalAnalyses: 3 }))).toContain("USER PATTERN HISTORY");
    expect(renderMemoryForPrompt(snap({ totalGraded: 5 }))).toContain("USER PATTERN HISTORY");
  });
});

describe("renderMemoryForPrompt — content", () => {
  it("names recurring patterns with book, cite count, and recency", () => {
    const out = renderMemoryForPrompt(
      snap({
        totalAnalyses: 4,
        patterns: [
          { principle: "OFNR Model", book: "Nonviolent Communication", citedCount: 3, lastCitedAt: new Date().toISOString() },
        ],
      })
    )!;
    expect(out).toContain("OFNR Model");
    expect(out).toContain("(Nonviolent Communication)");
    expect(out).toContain("cited 3×");
    expect(out).toContain("today"); // lastCitedAt = now → "today"
  });

  it("reports the recent grade mix as percentages of n", () => {
    const out = renderMemoryForPrompt(
      snap({ totalGraded: 10, recentGradeMix: { productive: 5, neutral: 3, needsGuidance: 2 } })
    )!;
    expect(out).toContain("n=10");
    expect(out).toContain("50% productive");
  });

  it("omits the patterns block when there are none but history is otherwise sufficient", () => {
    const out = renderMemoryForPrompt(snap({ totalGraded: 6, patterns: [] }))!;
    expect(out).toContain("USER PATTERN HISTORY");
    expect(out).not.toContain("Recurring patterns you've already named");
  });
});
