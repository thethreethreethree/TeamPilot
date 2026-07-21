import { describe, it, expect } from "vitest";
import {
  careQualityScore,
  careQualityToGrade,
  gradeCareAggregate,
  type CareCoachAggregate,
} from "../careQualityGrade";

const NO_RISK = { unsupportedAbsolutes: 0, fabricatedSpecifics: 0, emptyFiller: 0 };

function agg(p: Partial<CareCoachAggregate>): CareCoachAggregate {
  return {
    repliesGraded: 10,
    acknowledgedCount: 0,
    answeredCount: 0,
    nextStepCount: 0,
    risks: NO_RISK,
    ...p,
  };
}

describe("careQualityScore", () => {
  it("is null with no graded replies (§3.5 honest-empty)", () => {
    expect(careQualityScore(agg({ repliesGraded: 0 }))).toBeNull();
  });

  it("is 1.0 when all three positive signals present on every reply, no risks", () => {
    const s = careQualityScore(
      agg({ acknowledgedCount: 10, answeredCount: 10, nextStepCount: 10 })
    );
    expect(s).toBeCloseTo(1.0, 5);
  });

  it("counts the share of the three positive signals present", () => {
    // 2 of 3 signals on every reply → 20/30 ≈ 0.667
    const s = careQualityScore(
      agg({ acknowledgedCount: 10, answeredCount: 10, nextStepCount: 0 })
    );
    expect(s).toBeCloseTo(20 / 30, 5);
  });

  it("subtracts risks, capped at 0.5", () => {
    // full positives (1.0) minus a heavy risk load — penalty capped at 0.5
    const s = careQualityScore(
      agg({
        acknowledgedCount: 10,
        answeredCount: 10,
        nextStepCount: 10,
        risks: { unsupportedAbsolutes: 20, fabricatedSpecifics: 20, emptyFiller: 20 },
      })
    );
    expect(s).toBeCloseTo(0.5, 5); // 1.0 - min(6.0, 0.5)
  });

  it("clamps to [0,1]", () => {
    const s = careQualityScore(
      agg({ acknowledgedCount: 0, risks: { unsupportedAbsolutes: 10, fabricatedSpecifics: 0, emptyFiller: 0 } })
    );
    expect(s).toBe(0);
  });
});

describe("careQualityToGrade", () => {
  it("null score → not-yet, never a low letter (§3.5)", () => {
    const g = careQualityToGrade(null);
    expect(g.letter).toBeNull();
    expect(g.tier).toBe("not-yet");
  });

  it("anchors B at 0.60 (meets the competent-reply standard)", () => {
    expect(careQualityToGrade(0.6).letter).toBe("B");
    expect(careQualityToGrade(0.6).tier).toBe("solid");
  });

  it("maps high scores to the A range (strong)", () => {
    expect(careQualityToGrade(0.95).letter).toBe("A+");
    expect(careQualityToGrade(0.85).letter).toBe("A");
    expect(careQualityToGrade(0.78).letter).toBe("A-");
    expect(careQualityToGrade(0.85).tier).toBe("strong");
  });

  it("has NO F — floor is D / growth-area (§A18)", () => {
    for (const s of [0, 0.1, 0.27]) {
      expect(careQualityToGrade(s).letter).toBe("D");
      expect(careQualityToGrade(s).letter).not.toBe("F");
      expect(careQualityToGrade(s).tier).toBe("growth-area");
    }
  });

  it("is total across [0,1] and clamps out-of-range", () => {
    for (let s = 0; s <= 1.0001; s += 0.05) {
      expect(careQualityToGrade(s).letter).toBeTruthy();
    }
    expect(careQualityToGrade(2).letter).toBe("A+");
    expect(careQualityToGrade(-1).letter).toBe("D");
  });

  it("gradeCareAggregate composes score + grade", () => {
    const g = gradeCareAggregate(
      agg({ acknowledgedCount: 10, answeredCount: 10, nextStepCount: 10 })
    );
    expect(g.letter).toBe("A+");
    expect(g.score).toBeCloseTo(1.0, 5);
  });
});
