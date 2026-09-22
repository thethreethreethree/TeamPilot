import { describe, it, expect } from "vitest";
import { readTeamAssessment } from "../readTeamAssessment";
import { SECTIONS } from "../../pitchScore/rubric";

/**
 * The read that assembles the manager dashboard.
 *
 * The rules live in `teamAssessment.ts` and are tested there. What this file covers is the
 * assembly, where the failures are not wrong numbers but numbers that do not agree with each
 * other:
 *
 *   · the launch checklist's "rep totals sum to team totals" — true by construction today, and
 *     construction is exactly what a refactor changes
 *   · a rep with doors and no scored pitch, who is who the board is for
 *   · a pitch with no rep, which must not be in a team average it cannot be in a row of
 */

type Pitch = {
  id: string;
  repId?: string;
  total: number;
  base: number;
  bonus: number;
  violations: number;
  qualifying: boolean;
  sectionPoints: Record<string, number> | null;
  recordedAt: string;
  notQualifyingReason: string | null;
  deliveryScaled: boolean;
  elements: never[];
  events: never[];
};

const pitch = (over: Partial<Pitch> & { id: string }): Pitch => ({
  repId: "rep-1",
  total: 80,
  base: 70,
  bonus: 12,
  violations: 2,
  qualifying: true,
  sectionPoints: Object.fromEntries(SECTIONS.map((s) => [s.id, s.maxPoints / 2])),
  recordedAt: "2026-03-10T10:00:00Z",
  notQualifyingReason: null,
  deliveryScaled: false,
  elements: [],
  events: [],
  ...over,
});

/** Doubles the two reads: `pitch_scores` (via readPitchPeriod) and the `rep_kpi_daily` view. */
function db(opts: { pitches?: Pitch[]; daily?: Array<Record<string, unknown>>; failPitches?: boolean }) {
  const make = (table: string) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      in: () => chain,
    };
    (chain as { then: unknown }).then = (res: (v: unknown) => void) => {
      if (table === "rep_kpi_daily") return res({ data: opts.daily ?? [], error: null });
      if (opts.failPitches) return res({ data: null, error: { message: "boom" } });
      return res({
        data: (opts.pitches ?? []).map((p) => ({
          id: p.id,
          rep_id: p.repId ?? null,
          total: p.total,
          base: p.base,
          bonus: p.bonus,
          violations: p.violations,
          qualifying: p.qualifying,
          not_qualifying_reason: p.notQualifyingReason,
          delivery_scaled: p.deliveryScaled,
          section_points: p.sectionPoints,
          recorded_at: p.recordedAt,
          band: null,
        })),
        error: null,
      });
    };
    return chain;
  };
  return { from: make } as never;
}

const daily = (repId: string, doors: number, sold: number, noAnswer = 0) => ({
  rep_id: repId,
  doors_knocked: doors,
  sold,
  no_answer: noAnswer,
});

describe("rep totals sum to team totals — the launch checklist's own line", () => {
  it("holds across two reps with different volumes", async () => {
    const r = await readTeamAssessment(
      {
        companyId: "co",
        themes: [],
      },
      db({
        pitches: [
          pitch({ id: "a", repId: "rep-1", total: 80 }),
          pitch({ id: "b", repId: "rep-1", total: 90 }),
          pitch({ id: "c", repId: "rep-2", total: 70 }),
        ],
        daily: [daily("rep-1", 40, 3), daily("rep-2", 20, 1)],
      })
    );
    const rows = r!.reps;
    expect(rows.reduce((s, x) => s + x.totalPoints, 0)).toBeCloseTo(r!.team.totalPoints, 5);
    expect(rows.reduce((s, x) => s + x.doors, 0)).toBe(r!.team.kpis.doorsKnocked);
    expect(rows.reduce((s, x) => s + x.sold, 0)).toBe(r!.team.kpis.sold);
  });

  it("counts every scored pitch once", async () => {
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({
        pitches: [
          pitch({ id: "a", repId: "rep-1" }),
          pitch({ id: "b", repId: "rep-2" }),
          pitch({ id: "c", repId: "rep-2" }),
        ],
        daily: [],
      })
    );
    expect(r!.team.pitchesTotal).toBe(3);
    expect(Object.keys(r!.detail)).toHaveLength(2);
  });
});

describe("the rows come back ranked", () => {
  it("returns them in the table's order, not the map's", async () => {
    // Found by mutation: dropping `rankReps` from the read changed no test, because ranking is
    // tested on its own and this file only ever summed the rows. Order is what a manager reads
    // first, and insertion order here is whatever the pitch read happened to return.
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({
        pitches: [
          pitch({ id: "a", repId: "small", total: 10 }),
          pitch({ id: "b", repId: "big", total: 90 }),
          pitch({ id: "c", repId: "big", total: 90 }),
        ],
        daily: [],
      })
    );
    expect(r!.reps.map((x) => x.repId)).toEqual(["big", "small"]);
  });
});

describe("a pitch with no rep is excluded and reported, not absorbed", () => {
  it("keeps it out of the team average so the sum-to-rows identity survives", async () => {
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({
        pitches: [pitch({ id: "a", repId: "rep-1" }), pitch({ id: "orphan", repId: undefined })],
        daily: [],
      })
    );
    expect(r!.unattributed).toBe(1);
    expect(r!.team.pitchesTotal).toBe(1);
    expect(r!.reps.reduce((s, x) => s + x.totalPoints, 0)).toBeCloseTo(r!.team.totalPoints, 5);
  });
});

describe("a rep who knocked doors and recorded nothing still gets a row", () => {
  it("appears with zero pitches and their real door count", async () => {
    // Exactly who the board is for. Keying only off pitch_scores would drop them.
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({ pitches: [pitch({ id: "a", repId: "rep-1" })], daily: [daily("rep-2", 55, 0)] })
    );
    const quiet = r!.reps.find((x) => x.repId === "rep-2");
    expect(quiet).toBeTruthy();
    expect(quiet!.doors).toBe(55);
    expect(quiet!.totalPoints).toBe(0);
    // No scored pitch means no lowest section — not "Introduction" by default.
    expect(quiet!.lowestSection).toBeNull();
  });

  it("gives them no close rate rather than 0%", async () => {
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({ pitches: [], daily: [daily("rep-2", 30, 0, 30)] })
    );
    // 30 doors, all no_answer → 0 spoken to → no presentations → no rate.
    expect(r!.reps[0]!.closeRate).toBeNull();
  });
});

describe("presentations use the founder's definition, not recorded pitches", () => {
  it("counts doors spoken to — doors minus no_answer", async () => {
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({ pitches: [pitch({ id: "a", repId: "rep-1" })], daily: [daily("rep-1", 10, 2, 4)] })
    );
    // 10 doors − 4 no_answer = 6 spoken to. One recorded pitch; the definition ignores it.
    expect(r!.reps[0]!.presentations).toBe(6);
  });
});

describe("failure is a failure", () => {
  it("returns null when the pitch read fails, rather than an empty team", async () => {
    // A dashboard of zeros about a week the team worked reads as a collapse, not as a failed read.
    expect(await readTeamAssessment({ companyId: "co" }, db({ failPitches: true }))).toBeNull();
  });
});

describe("the six bars and the priority cards come out of the same aggregate", () => {
  it("bars carry the team's section averages", async () => {
    const r = await readTeamAssessment(
      { companyId: "co" },
      db({ pitches: [pitch({ id: "a", repId: "rep-1" })], daily: [] })
    );
    expect(r!.bars).toHaveLength(6);
    // Every section was seeded at half its max, so the flagged one is a tie broken by the
    // authority rather than by this module — the assertion is that exactly one is flagged.
    expect(r!.bars.filter((b) => b.lowest)).toHaveLength(1);
  });

  it("draws no priority cards without a brief", async () => {
    const r = await readTeamAssessment(
      { companyId: "co", themes: [] },
      db({ pitches: [pitch({ id: "a" })], daily: [] })
    );
    expect(r!.priorities).toEqual([]);
  });
});
