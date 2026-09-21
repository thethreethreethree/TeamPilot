import { describe, it, expect } from "vitest";

/**
 * The Pitch Score competition board.
 *
 * A leaderboard is the worst possible place for a quiet arithmetic bug: everyone can see the
 * number and nobody can see the rule. So these tests are mostly about the three decisions this
 * module consumes rather than makes — the per-rep totals, the rank numbering, and the prize
 * threshold — and about the one coupling that fails silently: `competitionRanks` does not sort,
 * so a board handed unsorted rows still returns ranks, ascending with array position.
 */

import { buildPitchLeaderboard, standingOf } from "../leaderboard";
import { PRIZE_ELIGIBLE_MIN_PITCHES } from "../rubric";
import { competitionRanks } from "@/lib/coach/gamification/competitionRank";
import type { AggregablePitch } from "../aggregate";

/** A qualifying pitch worth `total`, attributed to `repId`. */
const pitch = (repId: string, total: number, qualifying = true): AggregablePitch => ({
  repId,
  score: {
    base: qualifying ? 45 : 20,
    bonus: 0,
    violations: 0,
    total,
    qualifying,
    notQualifyingReason: qualifying ? null : "Base under 40",
    // Every section, because the type is a Record and a partial one is not a smaller fixture,
    // it is a different shape. Zeros throughout: this suite is about totals and ranks, and a
    // section breakdown that mattered here would mean the board was re-deriving the score.
    sectionPoints: {
      introduction: 0, discovery: 0, consulting: 0, close: 0, transitions: 0, delivery: 0,
    },
    bonusBreakdown: [],
    violationBreakdown: [],
  },
  elements: [],
});

const many = (repId: string, n: number, total: number) =>
  Array.from({ length: n }, () => pitch(repId, total));

describe("the board ranks on total points from counted pitches", () => {
  it("orders reps by total, highest first", () => {
    const rows = buildPitchLeaderboard([
      ...many("b", 2, 50),  // 100
      ...many("a", 3, 60),  // 180
      ...many("c", 1, 70),  // 70
    ]);
    expect(rows.map((r) => r.repId)).toEqual(["a", "b", "c"]);
    expect(rows.map((r) => r.total_points)).toEqual([180, 100, 70]);
  });

  it("counts TOTAL, not average — volume at a good score beats a single great pitch", () => {
    // The rule the record fixed: "Pitch Score leaderboard = total points from counted pitches."
    // An average-based board would invert this pair, so the fixture is built to disagree.
    const rows = buildPitchLeaderboard([...many("steady", 4, 60), ...pitchOnce("spike", 95)]);
    expect(rows[0]!.repId).toBe("steady");
    expect(rows[0]!.total_points).toBe(240);
    expect(rows[1]!.avgPitchScore).toBeGreaterThan(rows[0]!.avgPitchScore);
  });

  it("excludes pitches that did not qualify", () => {
    // A rep cannot climb by handing in pitches that never reached Discovery.
    const rows = buildPitchLeaderboard([
      pitch("a", 60),
      pitch("a", 200, false), // enormous, and it must not count
    ]);
    expect(rows[0]!.total_points).toBe(60);
    expect(rows[0]!.counted).toBe(1);
    expect(rows[0]!.pitchesTotal).toBe(2);
  });
});

describe("ranking is the shared authority, not a local loop", () => {
  it("gives tied reps the same place and skips the next", () => {
    // Standard competition ranking: 1-2-2-4, never dense 1-2-2-3.
    const rows = buildPitchLeaderboard([
      ...many("w", 1, 90),
      ...many("x", 1, 70),
      ...many("y", 1, 70),
      ...many("z", 1, 50),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("agrees with competitionRanks on the rows it produced", () => {
    // Derived, not retyped: if this module ever grew its own numbering, this fails without anyone
    // having to predict what the wrong numbers would be.
    const rows = buildPitchLeaderboard([
      ...many("a", 2, 60), ...many("b", 3, 40), ...many("c", 1, 120), ...many("d", 4, 30),
    ]);
    expect(rows.map((r) => r.rank)).toEqual(competitionRanks(rows));
  });

  it("sorts BEFORE ranking, which is the silent failure", () => {
    // competitionRanks documents that it does not re-sort. Handed unsorted rows it still returns
    // ranks — ascending with array position — so a board that forgot to sort looks like a board.
    // The input here is deliberately in worst-case order: lowest total first.
    const rows = buildPitchLeaderboard([
      ...many("last", 1, 10),
      ...many("first", 1, 99),
    ]);
    expect(rows[0]!.repId).toBe("first");
    expect(rows[0]!.rank).toBe(1);
    expect(rows[1]!.rank).toBe(2);
  });

  it("is deterministic when two reps tie on everything", () => {
    const a = buildPitchLeaderboard([...many("zeta", 2, 50), ...many("alpha", 2, 50)]);
    const b = buildPitchLeaderboard([...many("alpha", 2, 50), ...many("zeta", 2, 50)]);
    expect(a.map((r) => r.repId)).toEqual(b.map((r) => r.repId));
    expect(a.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("puts the rep with more counted pitches first when totals tie", () => {
    // Display order only — they share a rank either way — but the harder-earned total leads.
    const rows = buildPitchLeaderboard([...many("few", 1, 60), ...many("many", 3, 20)]);
    expect(rows.map((r) => r.repId)).toEqual(["many", "few"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });
});

describe("prize eligibility comes from the rubric's threshold", () => {
  it("is false below the threshold and true at it", () => {
    const below = buildPitchLeaderboard(many("a", PRIZE_ELIGIBLE_MIN_PITCHES - 1, 50));
    const at = buildPitchLeaderboard(many("b", PRIZE_ELIGIBLE_MIN_PITCHES, 50));
    expect(below[0]!.prizeEligible).toBe(false);
    expect(at[0]!.prizeEligible).toBe(true);
  });

  it("counts only qualifying pitches toward it", () => {
    // Five pitches, four of them not qualifying. Not eligible.
    const rows = buildPitchLeaderboard([
      pitch("a", 60),
      ...Array.from({ length: 4 }, () => pitch("a", 60, false)),
    ]);
    expect(rows[0]!.pitchesTotal).toBe(5);
    expect(rows[0]!.counted).toBe(1);
    expect(rows[0]!.prizeEligible).toBe(false);
  });

  it("does not remove an ineligible rep from the board", () => {
    // They are ranked; they are simply not up for the prize. Hiding them would make the board
    // disagree with the team's own sense of who is doing well.
    const rows = buildPitchLeaderboard([...many("new", 1, 80), ...many("veteran", 6, 10)]);
    expect(rows.map((r) => r.repId)).toContain("new");
    expect(rows.find((r) => r.repId === "new")!.prizeEligible).toBe(false);
    expect(rows.find((r) => r.repId === "veteran")!.prizeEligible).toBe(true);
  });
});

describe("an unattributable pitch never becomes a nameless rep", () => {
  it("drops pitches with no repId rather than pooling them", () => {
    const orphan = { ...pitch("x", 90) };
    delete (orphan as { repId?: string }).repId;
    const rows = buildPitchLeaderboard([orphan, ...many("a", 1, 10)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.repId).toBe("a");
    // A pooled row would sit at the top of this board holding 90 points nobody can dispute.
    expect(rows.some((r) => r.total_points === 90)).toBe(false);
  });

  it("returns an empty board rather than throwing when nothing is attributable", () => {
    const orphan = { ...pitch("x", 50) };
    delete (orphan as { repId?: string }).repId;
    expect(buildPitchLeaderboard([orphan])).toEqual([]);
  });
});

describe("one rep's own standing", () => {
  const rows = () => buildPitchLeaderboard([...many("a", 2, 60), ...many("b", 1, 30)]);

  it("finds them", () => {
    expect(standingOf(rows(), "b")).toMatchObject({ rank: 2, total_points: 30 });
  });

  it("returns null for a rep with no scored pitch, never a zero row", () => {
    // Null is not last. A rep who has not been recorded this week has not lost the competition.
    expect(standingOf(rows(), "nobody")).toBeNull();
  });
});

function pitchOnce(repId: string, total: number): AggregablePitch[] {
  return [pitch(repId, total)];
}
