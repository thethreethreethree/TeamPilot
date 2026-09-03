import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { competitionRanks, rankOf, type RankableRow } from "../competitionRank";

const row = (total_points: number | string): RankableRow => ({ total_points });

describe("competitionRanks", () => {
  it("gives two reps on identical points the SAME rank", () => {
    // The whole point. Telling one of two identical reps they came second is
    // false, and it is the kind of thing a person remembers being told.
    expect(competitionRanks([row(200), row(200)])).toEqual([1, 1]);
  });

  it("skips the place a tie consumed, so 3rd really is third", () => {
    // 1, 2, 2, 4 — not 1, 2, 2, 3. Without the skip a rep ranked 3rd of five
    // appears to be beating three people when they are beating two.
    expect(competitionRanks([row(300), row(200), row(200), row(100)])).toEqual([1, 2, 2, 4]);
  });

  it("handles a three-way tie and resumes at the right place", () => {
    expect(competitionRanks([row(50), row(50), row(50), row(10)])).toEqual([1, 1, 1, 4]);
  });

  it("ranks distinct totals plainly", () => {
    expect(competitionRanks([row(30), row(20), row(10)])).toEqual([1, 2, 3]);
  });

  it("treats a bigint STRING and a number as the same total", () => {
    // total_points is a bigint in the 0243 aggregate and PostgREST serialises
    // it as a string. Comparing raw values would make "200" and 200 look like
    // different totals and silently stop two tied reps from sharing a rank —
    // the exact bug this function exists to prevent, hidden by a type.
    expect(competitionRanks([row("200"), row(200)])).toEqual([1, 1]);
    expect(competitionRanks([row("300"), row("200"), row(200)])).toEqual([1, 2, 2]);
  });

  it("does not re-sort: the aggregate's order is the board's order", () => {
    // Given rows out of order it must not silently reorder them; the RPC owns
    // the ordering and a second opinion here would put the ranks on the wrong
    // rows.
    expect(competitionRanks([row(10), row(30)])).toEqual([1, 2]);
  });

  it("treats an unreadable total as zero rather than throwing", () => {
    expect(competitionRanks([row(10), { total_points: null }])).toEqual([1, 2]);
    expect(competitionRanks([{ total_points: "not a number" }])).toEqual([1]);
  });

  it("returns nothing for an empty board", () => {
    expect(competitionRanks([])).toEqual([]);
  });
});

describe("rankOf", () => {
  it("gives the caller their shared rank, not their row position", () => {
    const rows = [row(90), row(90), row(70)];
    expect(rankOf(rows, 1)).toBe(1); // tied with the row above, not 2nd
    expect(rankOf(rows, 2)).toBe(3);
  });

  it("is null for a rep who is not on the board", () => {
    // Not zero and not "last": a rep with no scored session has no standing
    // yet, which is a different thing from being bottom.
    expect(rankOf([row(90)], -1)).toBeNull();
    expect(rankOf([row(90)], 5)).toBeNull();
    expect(rankOf([], 0)).toBeNull();
  });
});

describe("the render surfaces use the rule, not the row index", () => {
  /**
   * A source-level check, and it exists because a mutation exposed the hole.
   *
   * Reverting `Scoreboard.tsx` to `{i + 1}` passed every test in this repo: nothing renders that component, so the
   * shared module can be perfect while the board beside it quietly ranks by position again. That is the same
   * failure this whole build is about — a rule with one definition, re-derived at a render site — one level up.
   *
   * Narrow on purpose (A33): two named files, comments stripped, looking only for the row index used as a rank.
   * A broader check would fire on every legitimate `i + 1` in the repo, and a gate that cries wolf is one people
   * learn to skip.
   */
  const SURFACES = [
    "src/components/sales-coach/Scoreboard.tsx",
    "src/lib/coach/gamification/weeklyDigest.ts",
  ];

  for (const rel of SURFACES) {
    it(`${rel} ranks with competitionRanks, not the row index`, () => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");

      expect(code, `${rel} does not import the shared rule`).toMatch(/competitionRanks|rankOf/);

      // The row index may still appear as a FALLBACK (`ranks[i] ?? i + 1`), which is correct — it cannot be
      // reached when ranks is built to the same length. What must not appear is the index used as the rank
      // itself: assigned to a `rank`/`place` variable, or rendered directly.
      expect(code, `${rel} assigns the row index as the rank`).not.toMatch(
        /(const|let)\s+(rank|place)\s*=\s*i\s*\+\s*1\s*[;,]/,
      );
      expect(code, `${rel} renders the row index as the rank`).not.toMatch(/\{i \+ 1\}</);
    });
  }
});
