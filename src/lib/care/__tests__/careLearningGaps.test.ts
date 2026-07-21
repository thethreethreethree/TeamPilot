import { describe, it, expect } from "vitest";
import { deriveLearningGaps } from "../careLearningGaps";
import type { CareCoachAggregate } from "../careQualityGrade";

const NO_RISK = { unsupportedAbsolutes: 0, fabricatedSpecifics: 0, emptyFiller: 0 };

function agg(p: Partial<CareCoachAggregate>): CareCoachAggregate {
  return {
    repliesGraded: 10,
    acknowledgedCount: 10,
    answeredCount: 10,
    nextStepCount: 10,
    risks: NO_RISK,
    ...p,
  };
}

describe("deriveLearningGaps", () => {
  it("returns nothing with no graded replies", () => {
    expect(deriveLearningGaps(agg({ repliesGraded: 0 }))).toEqual([]);
  });

  it("returns nothing when the agent is solid (all positives high, no risk)", () => {
    expect(deriveLearningGaps(agg({}))).toEqual([]);
  });

  it("flags the weakest positive signal when it's below the competent bar", () => {
    // next_step present on only 3/10 replies → below 0.6
    const gaps = deriveLearningGaps(agg({ nextStepCount: 3 }));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.book).toBe("Influence"); // next_step → Cialdini
    expect(gaps[0]!.skill).toMatch(/next step/i);
  });

  it("picks the SINGLE weakest positive (not all below-bar ones)", () => {
    // acknowledged 2/10 (0.2) is weaker than answered 5/10 (0.5) — only the weakest is coached
    const gaps = deriveLearningGaps(agg({ acknowledgedCount: 2, answeredCount: 5, nextStepCount: 10 }));
    const positiveGaps = gaps.filter((g) => g.book === "Never Split the Difference");
    expect(positiveGaps).toHaveLength(1);
    expect(gaps[0]!.book).toBe("Never Split the Difference"); // acknowledged → Voss, worst-first
  });

  it("flags the most-frequent risk when one occurs", () => {
    const gaps = deriveLearningGaps(
      agg({ risks: { unsupportedAbsolutes: 1, fabricatedSpecifics: 4, emptyFiller: 2 } })
    );
    // positives are all high → only the risk shows; fabricated is worst
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.book).toBe("Made to Stick"); // fabricated_specifics → Heath
  });

  it("returns at most two, positive-first then risk, worst-first", () => {
    const gaps = deriveLearningGaps(
      agg({
        acknowledgedCount: 1, // weakest positive
        answeredCount: 4,
        nextStepCount: 3,
        risks: { unsupportedAbsolutes: 0, fabricatedSpecifics: 0, emptyFiller: 5 },
      })
    );
    expect(gaps).toHaveLength(2);
    expect(gaps[0]!.book).toBe("Never Split the Difference"); // positive gap first (acknowledged)
    expect(gaps[1]!.book).toBe("On Writing Well"); // empty_filler risk → Zinsser
  });

  it("does not flag a positive signal that meets the bar exactly (0.6)", () => {
    // 6/10 = 0.6 is NOT below the threshold
    const gaps = deriveLearningGaps(agg({ acknowledgedCount: 6, answeredCount: 10, nextStepCount: 10 }));
    expect(gaps).toEqual([]);
  });
});
