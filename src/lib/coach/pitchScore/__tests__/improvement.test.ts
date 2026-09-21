import { describe, it, expect } from "vitest";

/**
 * The rep against their own past.
 *
 * The subtraction is trivial. What these tests are about is the Understanding Gate: a comparison
 * of one pitch against one pitch is arithmetic, not evidence — a single Hit moves an element's
 * average by its full value — and `docs/SalesCoach-KPI-System.md` makes "insufficient data" a
 * state that must be VISIBLE rather than quietly replaced by something that looks like an answer.
 *
 * So the three verdicts are genuinely different and each is pinned:
 *   improved      — enough evidence, and something rose
 *   no_change     — enough evidence, and nothing rose  (a real answer)
 *   insufficient  — not enough to say                  (not the same thing)
 */

import {
  biggestImprovement,
  MIN_PITCHES_FOR_COMPARISON,
  MIN_IMPROVEMENT_POINTS,
} from "../improvement";
import type { PeriodAggregate, ElementStat } from "../aggregate";

const stat = (elementId: string, label: string, avgPoints: number, gradedIn = 10): ElementStat => ({
  elementId,
  section: "close",
  label,
  maxPoints: 8,
  avgPoints,
  hitRate: 0,
  partialRate: 0,
  missedRate: 0,
  gradedIn,
});

/** Only `counted` and `elementStats` are read; the rest is filler the type requires. */
const period = (counted: number, elementStats: ElementStat[]): PeriodAggregate => ({
  pitchesTotal: counted,
  counted,
  notCounted: 0,
  notCountedReasons: {},
  totalPoints: 0,
  avgPitchScore: 0,
  avgBase: 0,
  avgBonus: 0,
  avgViolations: 0,
  bestPitchScore: null,
  sectionAverages: { introduction: 0, discovery: 0, consulting: 0, close: 0, transitions: 0, delivery: 0 },
  elementStats,
  bonusStats: [],
  violationStats: [],
  prizeEligible: false,
});

const N = MIN_PITCHES_FOR_COMPARISON;

describe("the understanding gate comes before the arithmetic", () => {
  it("refuses to compare when the BASELINE period is too thin", () => {
    // Two pitches against ten. One grade in the baseline moves an element by half its value, which
    // is larger than almost any improvement it would be reporting.
    const v = biggestImprovement(
      period(10, [stat("a", "A", 8)]),
      period(N - 1, [stat("a", "A", 1)])
    );
    expect(v.status).toBe("insufficient");
  });

  it("refuses when THIS period is too thin, even with a solid baseline", () => {
    const v = biggestImprovement(
      period(N - 1, [stat("a", "A", 8)]),
      period(10, [stat("a", "A", 1)])
    );
    expect(v.status).toBe("insufficient");
  });

  it("says WHICH period was thin, so the reason is actionable", () => {
    const v = biggestImprovement(period(10, [stat("a", "A", 8)]), period(1, [stat("a", "A", 1)]));
    expect(v.status === "insufficient" && v.reason).toMatch(/period before/i);
    expect(v.status === "insufficient" && v.reason).toMatch(/1 counted pitch\b/);
  });

  it("compares at exactly the threshold, not above it", () => {
    const v = biggestImprovement(
      period(N, [stat("a", "A", 5)]),
      period(N, [stat("a", "A", 1)])
    );
    expect(v.status).toBe("improved");
  });
});

describe("improved, and by how much", () => {
  it("picks the element that rose most", () => {
    const v = biggestImprovement(
      period(10, [stat("a", "Small", 2), stat("b", "Big", 7)]),
      period(10, [stat("a", "Small", 1), stat("b", "Big", 1)])
    );
    expect(v.status === "improved" && v.top.label).toBe("Big");
    expect(v.status === "improved" && v.top.gained).toBe(6);
  });

  it("reports before and after, not only the delta", () => {
    // "Tone 4.5 to 6.9" tells a rep where they are. "+2.4" tells them a direction.
    const v = biggestImprovement(
      period(10, [stat("a", "Tone", 6.9)]),
      period(10, [stat("a", "Tone", 4.5)])
    );
    expect(v.status === "improved" && v.top).toMatchObject({ before: 4.5, after: 6.9, gained: 2.4 });
  });

  it("rounds the gain, because two one-decimal averages subtract badly", () => {
    const v = biggestImprovement(
      period(10, [stat("a", "A", 100.1)]),
      period(10, [stat("a", "A", 100)])
    );
    // 100.1 - 100 is 0.09999999999999432 unrounded, which is also below the floor.
    expect(v.status).toBe("no_change");
  });

  it("ignores a move too small to be growth", () => {
    const v = biggestImprovement(
      period(10, [stat("a", "A", 2 + MIN_IMPROVEMENT_POINTS / 2)]),
      period(10, [stat("a", "A", 2)])
    );
    expect(v.status).toBe("no_change");
  });
});

describe("no_change is an answer, not a shrug", () => {
  it("says nothing rose when nothing rose", () => {
    const v = biggestImprovement(
      period(10, [stat("a", "A", 1)]),
      period(10, [stat("a", "A", 5)])
    );
    // Got WORSE. Still "enough evidence, nothing rose" — telling a rep the system could not tell
    // would be a lie in the flattering direction.
    expect(v.status).toBe("no_change");
  });

  it("is distinct from insufficient", () => {
    const enough = biggestImprovement(period(10, [stat("a", "A", 1)]), period(10, [stat("a", "A", 5)]));
    const thin = biggestImprovement(period(1, [stat("a", "A", 1)]), period(1, [stat("a", "A", 5)]));
    expect(enough.status).toBe("no_change");
    expect(thin.status).toBe("insufficient");
  });
});

describe("an element with no baseline is not an improvement", () => {
  it("skips an element that appears for the first time", () => {
    // Its "gain" would be its entire value, so it would win every comparison and tell a rep they
    // improved most at the thing they have done once.
    const v = biggestImprovement(
      period(10, [stat("new", "Brand new", 8), stat("old", "Old", 3)]),
      period(10, [stat("old", "Old", 1)])
    );
    expect(v.status === "improved" && v.top.label).toBe("Old");
  });

  it("skips an element graded in zero pitches this period", () => {
    const v = biggestImprovement(
      period(10, [stat("a", "A", 8, 0), stat("b", "B", 2)]),
      period(10, [stat("a", "A", 1), stat("b", "B", 1)])
    );
    expect(v.status === "improved" && v.top.label).toBe("B");
  });

  it("returns no_change when nothing is comparable at all", () => {
    const v = biggestImprovement(
      period(10, [stat("new", "Brand new", 8)]),
      period(10, [stat("gone", "Retired", 1)])
    );
    expect(v.status).toBe("no_change");
  });
});
