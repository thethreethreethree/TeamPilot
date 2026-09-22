import { describe, it, expect } from "vitest";
import {
  sectionBars,
  priorityCards,
  rankReps,
  vsTeam,
  prizeEligibleCount,
  type RepRow,
  type BriefTheme,
} from "../teamAssessment";
import { SECTIONS, lowestSection, type SectionId } from "../../pitchScore/rubric";
import type { PeriodAggregate } from "../../pitchScore/aggregate";

/**
 * The manager dashboard's arithmetic.
 *
 * Most of it is division. What these tests pin is the handful of places where a reasonable
 * implementation produces a number that is wrong in a way a manager would act on:
 *
 *   · a rate over an empty denominator rendered as 0% instead of "no rate yet"
 *   · a second lowest-section rule that disagrees with the rep's own Breakdown board
 *   · the coaching grade used as a sort, which the guide forbids in as many words
 *   · a percentage difference applied to two percentages
 */

const avgs = (o: Partial<Record<SectionId, number>>): Record<SectionId, number> =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, o[s.id] ?? 0])) as Record<SectionId, number>;

// The board's own team figures, so a failure here is legible against the PDF.
const BOARD = avgs({
  introduction: 9.8,
  discovery: 11.5,
  consulting: 8.9,
  close: 8.6,
  transitions: 4.7,
  delivery: 23.9,
});

/**
 * The activity ratios are NOT tested here, because they are not implemented here.
 *
 * `computeActivityKpis` in `pitchScore/aggregate.ts` owns them and has its own tests. This file
 * briefly had a second implementation with its own passing tests — which is the thing worth
 * noticing: duplicated logic arrives WITH duplicated tests, both green, and the tests make the
 * duplicate look more legitimate rather than less. Deleting them was the fix; leaving them would
 * have meant two suites asserting the same rule and neither one failing when they diverged.
 */

describe("section bars — the lowest flag is the rubric's, not ours", () => {
  it("flags exactly one section", () => {
    expect(sectionBars(BOARD).filter((b) => b.lowest)).toHaveLength(1);
  });

  it("flags by PERCENTAGE of max, matching the board and the rep's Breakdown", () => {
    // Delivery is 11.1 points short and Close is 6.4 short — but Close is 57% of its max and
    // Delivery is 68%, so the rubric says Close. The board's LOWEST tag sits on Close.
    const bars = sectionBars(BOARD);
    expect(bars.find((b) => b.lowest)!.id).toBe("close");
    const biggestAbsoluteGap = [...bars].sort((a, b) => b.pointsLeft - a.pointsLeft)[0]!;
    expect(biggestAbsoluteGap.id).toBe("delivery"); // the answer a Math.min would have given
  });

  it("agrees with the authority on every input, rather than reimplementing it", () => {
    const cases = [BOARD, avgs({ close: 15, delivery: 1 }), avgs({ introduction: 0.5 })];
    for (const c of cases) {
      expect(sectionBars(c).find((b) => b.lowest)?.id ?? null).toBe(lowestSection(c));
    }
  });

  it("never reports a negative gap", () => {
    // An override can push a section average above its rubric maximum.
    expect(sectionBars(avgs({ close: 99 })).find((b) => b.id === "close")!.pointsLeft).toBe(0);
  });

  it("returns all six, in rubric order", () => {
    expect(sectionBars(BOARD).map((b) => b.id)).toEqual(SECTIONS.map((s) => s.id));
  });
});

describe("priority cards — the words are the brief's, the numbers are the rubric's", () => {
  const bars = sectionBars(BOARD);

  it("maps a theme to the section its own words name", () => {
    const themes: BriefTheme[] = [
      { title: "Bridge the phases instead of narrating the script", why: "Reps blank mid-pitch or say the transition out loud." },
    ];
    const [card] = priorityCards(themes, bars);
    expect(card!.section).toBe("transitions");
    expect(card!.matched).toBe(true);
  });

  it("takes the section's real average and gap, never a number from the theme", () => {
    const [card] = priorityCards([{ title: "Close", why: "the close is weak" }], bars);
    expect(card!.teamAvg).toBe(8.6);
    expect(card!.max).toBe(15);
    expect(card!.pointsLeft).toBe(6.4);
  });

  it("assigns by largest remaining gap when the wording names nothing, and SAYS it assigned", () => {
    const [card] = priorityCards([{ title: "Be more confident", why: "general energy" }], bars);
    expect(card!.matched).toBe(false);
    expect(card!.section).toBe("delivery"); // the biggest remaining gap
  });

  it("never gives two cards the same section", () => {
    const themes: BriefTheme[] = [
      { title: "Close", why: "" },
      { title: "Close harder", why: "" },
      { title: "Close hardest", why: "" },
    ];
    const ids = priorityCards(themes, bars).map((c) => c.section);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lets a real match win its section even when an earlier theme would have been assigned it", () => {
    // Theme 1 names nothing and would take Delivery by gap; theme 2 names Delivery explicitly.
    // Matching runs first so theme 2 keeps it.
    const themes: BriefTheme[] = [
      { title: "Be more confident", why: "general" },
      { title: "Objection handling", why: "acknowledge and return to the close" },
    ];
    const cards = priorityCards(themes, bars);
    expect(cards[1]!.section).toBe("delivery");
    expect(cards[1]!.matched).toBe(true);
    expect(cards[0]!.section).not.toBe("delivery");
  });

  it("caps at three, which is what the board draws", () => {
    const themes = Array.from({ length: 6 }, (_, i) => ({ title: `t${i}`, why: "" }));
    expect(priorityCards(themes, bars)).toHaveLength(3);
  });

  it("is deterministic — the same brief twice is the same three cards", () => {
    const themes: BriefTheme[] = [
      { title: "a", why: "" },
      { title: "b", why: "" },
      { title: "c", why: "" },
    ];
    expect(priorityCards(themes, bars)).toEqual(priorityCards(themes, bars));
  });

  it("has nothing to say about an empty brief", () => {
    expect(priorityCards([], bars)).toEqual([]);
  });
});

describe("the reps table ranks by points, and never by the coaching grade", () => {
  const rep = (over: Partial<RepRow>): RepRow => ({
    repId: "r",
    fullName: "Rep",
    avgPitchScore: 70,
    band: "Solid",
    totalPoints: 100,
    doors: 10,
    presentations: 5,
    sold: 1,
    closeRate: 20,
    lowestSection: "close",
    lowestSectionLabel: "The close",
    focus: null,
    ...over,
  });

  it("orders by total points", () => {
    const rows = rankReps([
      rep({ repId: "a", fullName: "Anthony A.", totalPoints: 867 }),
      rep({ repId: "j", fullName: "John Knudtson", totalPoints: 1844 }),
      rep({ repId: "s", fullName: "James Soto", totalPoints: 1452 }),
    ]);
    expect(rows.map((r) => r.fullName)).toEqual(["John Knudtson", "James Soto", "Anthony A."]);
  });

  it("cannot order by the coaching grade, because the grade is not on the row", () => {
    // "The existing coaching grade and notes stay unranked; only the Pitch Score and KPIs are
    // compared across reps." The strongest form of that guarantee is not a test asserting the
    // sort ignores the grade — it is the grade being absent from what the sort can see. The
    // badge fetches it per rep, one request away, so the column exists and the data never
    // reaches the comparator.
    const keys = Object.keys(rep({}));
    expect(keys).not.toContain("coachingGrade");
    expect(keys).not.toContain("coachingGradeNote");
  });

  it("does not order by the average score either — points reward volume, by design", () => {
    const rows = rankReps([
      rep({ repId: "sharp", avgPitchScore: 120, totalPoints: 240 }),
      rep({ repId: "steady", avgPitchScore: 70, totalPoints: 1400 }),
    ]);
    expect(rows[0]!.repId).toBe("steady");
  });

  it("breaks ties by name so the table does not reshuffle between loads", () => {
    const rows = rankReps([
      rep({ repId: "z", fullName: "Zed", totalPoints: 100 }),
      rep({ repId: "a", fullName: "Amy", totalPoints: 100 }),
    ]);
    expect(rows.map((r) => r.fullName)).toEqual(["Amy", "Zed"]);
  });
});

describe("vs-team deltas use the right unit", () => {
  it("gives a percentage DIFFERENCE for counts", () => {
    // The board: 63 doors against a team average of ~134 reads "−53% vs. team avg".
    expect(vsTeam(63, 134, "count")).toEqual({ delta: -53, unit: "%" });
  });

  it("gives percentage POINTS for a rate, which is a different statement", () => {
    // 11% against a team 14% is "−3 pts", not "−21%". The second makes a manager think the rep
    // converts a fifth as often as they do.
    expect(vsTeam(11, 14, "rate")).toEqual({ delta: -3, unit: "pts" });
  });

  it("says nothing when either side is missing", () => {
    expect(vsTeam(null, 10, "count")).toBeNull();
    expect(vsTeam(10, null, "count")).toBeNull();
  });

  it("does not divide by a zero team average", () => {
    expect(vsTeam(5, 0, "count")).toBeNull();
  });
});

describe("prize eligibility is the rubric's threshold", () => {
  const agg = (counted: number) => ({ counted }) as PeriodAggregate;

  it("counts reps at or above the minimum", () => {
    expect(prizeEligibleCount([agg(5), agg(4), agg(9), agg(0), agg(5)], 5)).toBe(3);
  });

  it("is inclusive at the threshold — 5 counted pitches qualifies", () => {
    expect(prizeEligibleCount([agg(5)], 5)).toBe(1);
    expect(prizeEligibleCount([agg(4)], 5)).toBe(0);
  });
});
