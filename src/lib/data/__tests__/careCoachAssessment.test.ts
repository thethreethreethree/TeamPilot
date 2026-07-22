import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * fetchCoachAssessmentRoster — the per-agent C.A.R.E coaching roster. The properties that matter are
 * constitutional, not cosmetic:
 *   - §A18: the roster is ALWAYS alphabetical, NEVER sorted by grade (it must not become a leaderboard).
 *   - nobody is silently invisible: agents with zero graded replies appear in `noData`.
 *   - §3.6: the trajectory is a 4-week line oldest→newest, with null for weeks that have no graded replies.
 *   - §3.4: a failed read THROWS (honest error) rather than returning a false-empty roster.
 * Untested until now.
 */

type Counts = {
  positive: { acknowledged: number; answered: number; next_step: number };
  risks: { unsupported_absolutes: number; fabricated_specifics: number; empty_filler: number };
};
const counts = (): Counts => ({
  positive: { acknowledged: 1, answered: 1, next_step: 1 },
  risks: { unsupported_absolutes: 0, fabricated_specifics: 0, empty_filler: 0 },
});

const state = vi.hoisted(() => ({
  agents: [] as Array<{ id: string; full_name: string | null }>,
  agentsError: null as { message: string } | null,
  rows: [] as Array<{ author_id: string | null; coach_counts: unknown; created_at: string }>,
  rowsError: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/server", () => {
  const query = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "or", "not", "gte"]) b[m] = () => b;
    b.then = (resolve: (v: unknown) => void) => resolve(result);
    return b;
  };
  return {
    createClient: async () => ({
      from: (table: string) =>
        table === "profiles"
          ? query({ data: state.agents, error: state.agentsError })
          : query({ data: state.rows, error: state.rowsError }),
    }),
  };
});

const { fetchCoachAssessmentRoster } = await import("../careCoachAssessment");

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  state.agents = [];
  state.agentsError = null;
  state.rows = [];
  state.rowsError = null;
});

describe("fetchCoachAssessmentRoster", () => {
  it("§A18: returns the roster ALPHABETICAL, never grade-sorted", async () => {
    state.agents = [
      { id: "z", full_name: "Zoe" },
      { id: "a", full_name: "Alice" },
      { id: "b", full_name: "Bob" },
    ];
    state.rows = [
      { author_id: "z", coach_counts: counts(), created_at: daysAgo(1) },
      { author_id: "a", coach_counts: counts(), created_at: daysAgo(1) },
      { author_id: "b", coach_counts: counts(), created_at: daysAgo(1) },
    ];
    const r = await fetchCoachAssessmentRoster("c1");
    expect(r.agents.map((a) => a.agentName)).toEqual(["Alice", "Bob", "Zoe"]);
  });

  it("surfaces agents with no graded replies in noData (nobody silently invisible), sorted", async () => {
    state.agents = [
      { id: "a", full_name: "Alice" },
      { id: "c", full_name: "Carol" },
      { id: "b", full_name: "Bob" },
    ];
    state.rows = [{ author_id: "a", coach_counts: counts(), created_at: daysAgo(1) }];
    const r = await fetchCoachAssessmentRoster("c1");
    expect(r.agents.map((a) => a.agentName)).toEqual(["Alice"]);
    expect(r.noData).toEqual(["Bob", "Carol"]);
  });

  it("rolls up multiple replies per agent into one aggregate", async () => {
    state.agents = [{ id: "a", full_name: "Alice" }];
    state.rows = [
      { author_id: "a", coach_counts: counts(), created_at: daysAgo(1) },
      { author_id: "a", coach_counts: counts(), created_at: daysAgo(1) },
      { author_id: "a", coach_counts: counts(), created_at: daysAgo(2) },
    ];
    const r = await fetchCoachAssessmentRoster("c1");
    expect(r.agents[0]?.aggregate.repliesGraded).toBe(3);
  });

  it("§3.6: trajectory is a 4-week line oldest→newest, null for empty weeks", async () => {
    state.agents = [{ id: "a", full_name: "Alice" }];
    // one reply this week only
    state.rows = [{ author_id: "a", coach_counts: counts(), created_at: daysAgo(1) }];
    const r = await fetchCoachAssessmentRoster("c1");
    const traj = r.agents[0]?.trajectory ?? [];
    expect(traj).toHaveLength(4);
    expect(traj[3]).not.toBeNull(); // newest week has the reply
    expect(traj.slice(0, 3).every((w) => w === null)).toBe(true); // older weeks empty
  });

  it("§3.4: a failed read THROWS (never a false-empty roster)", async () => {
    state.agentsError = { message: "rls denied" };
    await expect(fetchCoachAssessmentRoster("c1")).rejects.toThrow(/agents read failed/);
  });

  it("bounded is false for a normal-size result", async () => {
    state.agents = [{ id: "a", full_name: "Alice" }];
    state.rows = [{ author_id: "a", coach_counts: counts(), created_at: daysAgo(1) }];
    expect((await fetchCoachAssessmentRoster("c1")).bounded).toBe(false);
  });
});
