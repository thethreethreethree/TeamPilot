import { describe, it, expect } from "vitest";
import {
  aggregatePitches,
  computeActivityKpis,
  countPresentations,
  sumTeamTotals,
  type AggregablePitch,
} from "../aggregate";
import { scorePitch, type GradedElement } from "../scorePitch";
import { SECTIONS, elementsForSection } from "../rubric";

/**
 * Aggregation, checked against the numbers the boards actually print.
 *
 * The launch checklist names three reconciliations that must hold in production — sections sum to
 * base, base + bonus − violations equals the shown average, and rep totals sum to team totals.
 * They are asserted here rather than left for a human to eyeball before shipping.
 */

const grade = (ids: string[], g: GradedElement["grade"]): GradedElement[] =>
  ids.map((elementId) => ({ elementId, grade: g }));

const allOf = (section: Parameters<typeof elementsForSection>[0]) =>
  elementsForSection(section).map((e) => e.id);

/** A qualifying pitch: Intro + Discovery + Consulting all hit = 42 base. */
function qualifyingPitch(extra: Partial<Parameters<typeof scorePitch>[0]> = {}): AggregablePitch {
  const elements = grade(
    [...allOf("introduction"), ...allOf("discovery"), ...allOf("consulting")],
    "hit"
  );
  return {
    score: scorePitch({ elements, objectionOccurred: true, reachedDiscovery: true, ...extra }),
    elements,
  };
}

describe("counted vs. not counted", () => {
  it("averages over qualifying pitches only, and explains the exclusions", () => {
    const pitches: AggregablePitch[] = [
      qualifyingPitch(),
      qualifyingPitch(),
      // A door slam: never reached Discovery. Must not drag the average down.
      {
        score: scorePitch({ elements: [], objectionOccurred: false, reachedDiscovery: false }),
        elements: [],
      },
      // Reached Discovery but too thin to count.
      {
        score: scorePitch({
          elements: grade(allOf("introduction"), "hit"),
          objectionOccurred: true,
          reachedDiscovery: true,
        }),
        elements: grade(allOf("introduction"), "hit"),
      },
    ];

    const a = aggregatePitches(pitches);
    expect(a.pitchesTotal).toBe(4);
    expect(a.counted).toBe(2);
    expect(a.notCounted).toBe(2);
    // The UI needs to say "2 didn't reach Discovery or scored under 40 base. Tap to see which."
    expect(a.notCountedReasons).toEqual({
      "Didn't reach Discovery": 1,
      "Scored under 40 base": 1,
    });
    // The two excluded pitches contributed nothing to the average.
    expect(a.avgBase).toBe(42);
  });

  it("returns a usable empty shape rather than NaN when nothing qualifies", () => {
    const a = aggregatePitches([
      { score: scorePitch({ elements: [], objectionOccurred: false, reachedDiscovery: false }), elements: [] },
    ]);
    expect(a.counted).toBe(0);
    expect(a.avgPitchScore).toBe(0);
    expect(a.bestPitchScore).toBeNull();
    expect(a.prizeEligible).toBe(false);
    // Division by zero anywhere here would render "NaN" on a rep's gauge.
    for (const s of SECTIONS) expect(Number.isFinite(a.sectionAverages[s.id])).toBe(true);
  });

  it("needs five counted pitches for prize eligibility", () => {
    const four = aggregatePitches(Array.from({ length: 4 }, () => qualifyingPitch()));
    const five = aggregatePitches(Array.from({ length: 5 }, () => qualifyingPitch()));
    expect(four.prizeEligible).toBe(false);
    expect(five.prizeEligible).toBe(true);
  });
});

describe("the launch-checklist reconciliations", () => {
  it("section averages sum to the base average, even on half-point sections", () => {
    // The fixture matters more than the assertion here. An earlier version graded whole sections
    // uniformly, which made every per-pitch section total a whole number — so a mutation that
    // rounded each pitch BEFORE summing changed nothing and the test stayed green. Grading a
    // single odd-point element Partial puts a .5 on the section total, which is the only shape
    // that catches it.
    const halfPoint = (): AggregablePitch => {
      const elements: GradedElement[] = [
        ...grade([...allOf("introduction"), ...allOf("discovery")], "hit"),
        // Consulting: 4+4+2+2+1+1 = 14, with the 1-pointer at half -> 13.5
        { elementId: "cons.sharedVsDedicated", grade: "hit" },
        { elementId: "cons.hotButtons", grade: "hit" },
        { elementId: "cons.checklistSpeed", grade: "hit" },
        { elementId: "cons.checklistPrice", grade: "hit" },
        { elementId: "cons.checklistEquipment", grade: "partial" },
        { elementId: "cons.checklistInstall", grade: "hit" },
        // Close: one 3-pointer at half -> 1.5
        { elementId: "close.qualification", grade: "partial" },
      ];
      return {
        score: scorePitch({ elements, objectionOccurred: true, reachedDiscovery: true }),
        elements,
      };
    };

    // One half-point pitch against two clean ones: consulting averages 41.5/3 = 13.8 and
    // close 1.5/3 = 0.5, both fractional. A 2:1 split made close land on exactly 1.0 and the
    // fixture stopped testing what it claims.
    const a = aggregatePitches([halfPoint(), qualifyingPitch(), qualifyingPitch()]);

    // Prove the fixture actually produces the fractional values the test depends on, so this
    // cannot silently decay back into a whole-number fixture.
    expect(a.sectionAverages.consulting % 1).not.toBe(0);
    expect(a.sectionAverages.close % 1).not.toBe(0);

    const summed = SECTIONS.reduce((n, s) => n + a.sectionAverages[s.id], 0);
    expect(Math.round(summed * 10) / 10).toBe(a.avgBase);
  });

  it("avg Pitch Score equals total points divided by counted pitches", () => {
    const a = aggregatePitches(Array.from({ length: 3 }, () => qualifyingPitch()));
    expect(a.avgPitchScore).toBe(Math.round((a.totalPoints / a.counted) * 10) / 10);
  });

  it("reproduces the rep board: 1445 points over 18 counted reads as 80.3", () => {
    expect(Math.round((1445 / 18) * 10) / 10).toBe(80.3);
  });

  it("reproduces the team card: 5773 points over 75 counted reads as 77.0", () => {
    expect(Math.round((5773 / 75) * 10) / 10).toBe(77.0);
  });

  it("rep totals sum to team totals", () => {
    const kpis = (d: number, p: number, s: number) =>
      computeActivityKpis({ doorsKnocked: d, recordedPitches: p, sold: s });
    // The five reps from the manager board.
    const team = sumTeamTotals([
      { totalPoints: 1844, counted: 25, kpis: kpis(138, 25, 8) },
      { totalPoints: 1452, counted: 24, kpis: kpis(156, 24, 5) },
      { totalPoints: 1333, counted: 22, kpis: kpis(154, 22, 4) },
      { totalPoints: 867, counted: 20, kpis: kpis(160, 20, 2) },
      { totalPoints: 277, counted: 7, kpis: kpis(63, 7, 1) },
    ]);
    expect(team.totalPoints).toBe(5773);
    expect(team.doorsKnocked).toBe(671);
    expect(team.presentations).toBe(98);
    expect(team.sold).toBe(20);
  });
});

describe("element stats — the formula the boards print", () => {
  it("avg points equal points x (hit + partial/2), matching the published Close table", () => {
    // Four pitches: 2 hit, 1 partial, 1 missed on a 3-point element.
    // 3 x (0.5 + 0.25/2... ) — concretely: (3 + 3 + 1.5 + 0) / 4 = 1.875 -> 1.9
    const mk = (g: GradedElement["grade"]): AggregablePitch => {
      const elements = [
        ...grade([...allOf("introduction"), ...allOf("discovery"), ...allOf("consulting")], "hit"),
        { elementId: "close.qualification", grade: g },
      ];
      return {
        score: scorePitch({ elements, objectionOccurred: true, reachedDiscovery: true }),
        elements,
      };
    };
    const a = aggregatePitches([mk("hit"), mk("hit"), mk("partial"), mk("missed")]);
    const stat = a.elementStats.find((e) => e.elementId === "close.qualification")!;

    expect(stat.hitRate).toBe(0.5);
    expect(stat.partialRate).toBe(0.25);
    expect(stat.missedRate).toBe(0.25);
    expect(stat.avgPoints).toBe(1.9); // 3 x (0.5 + 0.125) = 1.875
    expect(stat.gradedIn).toBe(4);
  });

  it("rates are over pitches where the element was GRADED, not over every counted pitch", () => {
    // A rep who never reached the Close in one pitch should not show that as a 'missed' — an
    // element they never got to is not a habit to coach. Same applicable-only rule Pattern
    // Interrupt uses for its 3-of-10.
    const withClose: AggregablePitch = (() => {
      const elements = [
        ...grade([...allOf("introduction"), ...allOf("discovery"), ...allOf("consulting")], "hit"),
        { elementId: "close.qualification", grade: "hit" as const },
      ];
      return { score: scorePitch({ elements, objectionOccurred: true, reachedDiscovery: true }), elements };
    })();
    const withoutClose = qualifyingPitch();

    const a = aggregatePitches([withClose, withoutClose]);
    const stat = a.elementStats.find((e) => e.elementId === "close.qualification")!;
    expect(stat.gradedIn).toBe(1);
    expect(stat.hitRate).toBe(1); // not 0.5
  });

  it("element averages within a section sum to that section's average", () => {
    const a = aggregatePitches([qualifyingPitch(), qualifyingPitch()]);
    const introSum = a.elementStats
      .filter((e) => e.section === "introduction")
      .reduce((n, e) => n + e.avgPoints, 0);
    expect(Math.round(introSum * 10) / 10).toBe(a.sectionAverages.introduction);
  });
});

describe("bonus and violation stats", () => {
  it("bonus avg is that bonus's points over counted pitches, and earned-in is the rate", () => {
    const withBonus = qualifyingPitch({ bonuses: [{ bonusId: "bonus.directv" }] });
    const a = aggregatePitches([withBonus, withBonus, qualifyingPitch(), qualifyingPitch()]);
    const stat = a.bonusStats.find((b) => b.bonusId === "bonus.directv")!;
    expect(stat.earnedInRate).toBe(0.5);
    expect(stat.avgPoints).toBe(2.5); // 5 x 0.5, the boards' "earned in %" x points
  });

  it("keeps a violation row at zero rather than dropping it", () => {
    // The board prints "Rude or dismissive — None — 0". Absence of the row and a zero on the row
    // read very differently to a rep: one looks like it was not checked.
    const a = aggregatePitches([qualifyingPitch(), qualifyingPitch()]);
    const rude = a.violationStats.find((v) => v.violationId === "viol.rude");
    expect(rude).toBeTruthy();
    expect(rude!.rate).toBe(0);
    expect(rude!.avgDeduction).toBe(0);
  });

  it("violation avg is the deduction spread over counted pitches", () => {
    const withViolation = qualifyingPitch({ violations: [{ violationId: "viol.talkingTooMuch" }] });
    const a = aggregatePitches([withViolation, qualifyingPitch(), qualifyingPitch(), qualifyingPitch()]);
    const stat = a.violationStats.find((v) => v.violationId === "viol.talkingTooMuch")!;
    expect(stat.rate).toBe(0.25);
    expect(stat.avgDeduction).toBe(1.3); // 5 / 4 = 1.25 -> 1.3
  });
});

describe("activity KPIs", () => {
  it("matches the team activity row: 671 doors, 98 presentations, 20 sold", () => {
    const k = computeActivityKpis({ doorsKnocked: 671, recordedPitches: 98, sold: 20 });
    expect(Math.round(k.doorToPresentationRate! * 100)).toBe(15); // 14.6% -> 15%
    expect(Math.round(k.closeRate! * 100)).toBe(20); // 20.4% -> 20%
  });

  it("returns null, not 0%, when the denominator is empty", () => {
    // A rep's first morning shows "—", not a 0% that reads as failure.
    const k = computeActivityKpis({ doorsKnocked: 0, recordedPitches: 0, sold: 0 });
    expect(k.doorToPresentationRate).toBeNull();
    expect(k.closeRate).toBeNull();
  });

  it("presentations default to recorded pitches, and the source is switchable in one place", () => {
    // Guide open decision #1 — unresolved, so the mockup's assumption is a default with its
    // provenance stated, and the alternative is already wired.
    expect(countPresentations({ recordedPitches: 98 })).toBe(98);
    expect(
      countPresentations({ recordedPitches: 98, repLoggedPresentations: 61, source: "rep_log" })
    ).toBe(61);
    expect(
      computeActivityKpis({
        doorsKnocked: 671,
        recordedPitches: 98,
        repLoggedPresentations: 61,
        sold: 20,
        presentationsSource: "rep_log",
      }).presentations
    ).toBe(61);
  });
});
