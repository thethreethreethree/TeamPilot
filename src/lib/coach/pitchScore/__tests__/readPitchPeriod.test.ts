import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Loading a period of pitches for the Breakdown board.
 *
 * Every test here is about a way the board could show a confident wrong average. That is the
 * failure mode that matters on this surface: a single pitch rendered wrongly is one screen, an
 * aggregate rendered wrongly is the number a rep is coached against for a week.
 */

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { readPitchPeriod } from "../readPitchPeriod";
import { aggregatePitches } from "../aggregate";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const SECTION_POINTS = {
  introduction: 9.5,
  discovery: 12,
  consulting: 8.4,
  close: 8.6,
  transitions: 4.7,
  delivery: 19.2,
};

const pitchRow = (o: Partial<Record<string, unknown>> = {}) => ({
  id: "p1",
  rep_id: "rep1",
  recorded_at: "2026-09-18T16:00:00Z",
  base: 62.4,
  bonus: 10,
  violations: 2,
  total: 70.4,
  qualifying: true,
  not_qualifying_reason: null,
  section_points: SECTION_POINTS,
  outcome: "sold",
  ...o,
});

/** Records the filters applied, so the tests can assert the query was actually scoped. */
let applied: { eq: [string, unknown][]; gte: unknown[]; lt: unknown[]; limit: number | null };

const mockDb = (opts: {
  pitches?: unknown[];
  elements?: unknown[];
  events?: unknown[];
  pitchError?: { message: string };
  childError?: { message: string };
} = {}) => {
  applied = { eq: [], gte: [], lt: [], limit: null };
  asMock(createClient).mockResolvedValue({
    from: (table: string) => {
      if (table === "pitch_scores") {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.order = () => chain;
        chain.eq = (c: string, v: unknown) => {
          applied.eq.push([c, v]);
          return chain;
        };
        chain.gte = (_c: string, v: unknown) => {
          applied.gte.push(v);
          return chain;
        };
        chain.lt = (_c: string, v: unknown) => {
          applied.lt.push(v);
          return chain;
        };
        chain.limit = (n: number) => {
          applied.limit = n;
          return Promise.resolve({
            data: opts.pitchError ? null : (opts.pitches ?? [pitchRow()]),
            error: opts.pitchError ?? null,
          });
        };
        return chain;
      }
      const rows = table === "pitch_score_elements" ? (opts.elements ?? []) : (opts.events ?? []);
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.in = async () => ({
        data: opts.childError ? null : rows,
        error: opts.childError ?? null,
      });
      return chain;
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the query is actually scoped", () => {
  it("filters to one rep when asked", async () => {
    await readPitchPeriod({ repId: "rep9" });
    expect(applied.eq).toContainEqual(["rep_id", "rep9"]);
  });

  it("does not filter by rep for a team view", async () => {
    await readPitchPeriod({});
    expect(applied.eq.find(([c]) => c === "rep_id")).toBeUndefined();
  });

  it("applies the date window", async () => {
    await readPitchPeriod({ from: "2026-09-14T00:00:00Z", to: "2026-09-21T00:00:00Z" });
    expect(applied.gte).toEqual(["2026-09-14T00:00:00Z"]);
    expect(applied.lt).toEqual(["2026-09-21T00:00:00Z"]);
  });

  it("keeps the limit under PostgREST's real cap", async () => {
    // A limit above max_rows=1000 is a false bound: it silently returns fewer rows and the
    // averages are computed over a subset nobody knows about.
    await readPitchPeriod({ limit: 99999 });
    expect(applied.limit).toBeLessThanOrEqual(1000);
  });
});

describe("nothing is recomputed", () => {
  it("uses the STORED section verdict, not a sum of the element rows", async () => {
    mockDb({
      pitches: [pitchRow()],
      elements: [
        { pitch_id: "p1", element_id: "deliv.tone", grade: "partial" },
        { pitch_id: "p1", element_id: "deliv.pace", grade: "hit" },
      ],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.score.sectionPoints.delivery).toBe(19.2);
  });

  it("reads bonus points at the value the scorer AWARDED", async () => {
    // Not the rubric's face value: the scorer already applied the repeatable ceiling and the +30
    // cap before these rows were written. Re-deriving would inflate every bonus rate on the board.
    mockDb({
      pitches: [pitchRow()],
      events: [{ pitch_id: "p1", type: "bonus", item_id: "bonus.directv", points: 5 }],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.score.bonusBreakdown).toEqual([
      { bonusId: "bonus.directv", points: 5, capped: false },
    ]);
  });

  it("ignores a rejected bonus — it awarded nothing", async () => {
    // Counting it would credit the rep, on the board, with a bonus the scorer explicitly withheld.
    mockDb({
      pitches: [pitchRow()],
      events: [{ pitch_id: "p1", type: "rejected_bonus", item_id: "bonus.inside", points: 0 }],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.score.bonusBreakdown).toEqual([]);
  });

  it("sums repeated events for the same item within a pitch", async () => {
    mockDb({
      pitches: [pitchRow()],
      events: [
        { pitch_id: "p1", type: "violation", item_id: "viol.talkingOver", points: 2 },
        { pitch_id: "p1", type: "violation", item_id: "viol.talkingOver", points: 2 },
      ],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.score.violationBreakdown[0]!.deduction).toBe(4);
  });

  it("drops an event whose id the rubric does not know", async () => {
    mockDb({
      pitches: [pitchRow()],
      events: [{ pitch_id: "p1", type: "bonus", item_id: "bonus.invented", points: 5 }],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.score.bonusBreakdown).toEqual([]);
  });

  it("attaches each pitch's own elements, not another pitch's", async () => {
    mockDb({
      pitches: [pitchRow({ id: "p1" }), pitchRow({ id: "p2" })],
      elements: [
        { pitch_id: "p1", element_id: "intro.trucks", grade: "hit" },
        { pitch_id: "p2", element_id: "deliv.tone", grade: "missed" },
      ],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.elements).toEqual([{ elementId: "intro.trucks", grade: "hit" }]);
    expect(r!.pitches[1]!.elements).toEqual([{ elementId: "deliv.tone", grade: "missed" }]);
  });
});

describe("a pitch with no section verdict", () => {
  it("is excluded and counted, not included with zeros", async () => {
    // Including it would drag every section average toward zero and read as a coaching problem
    // rather than as a pitch scored before the column existed.
    mockDb({ pitches: [pitchRow(), pitchRow({ id: "p2", section_points: null })] });
    const r = await readPitchPeriod({});
    expect(r!.pitches).toHaveLength(1);
    expect(r!.skippedPreVerdict).toBe(1);
  });

  it("does not skip a NON-qualifying pitch that has no verdict", async () => {
    // It contributes no averages anyway, and its exclusion reason is what the board reports as
    // "5 didn't reach Discovery" — dropping it would make that count wrong.
    mockDb({
      pitches: [
        pitchRow({ id: "p2", section_points: null, qualifying: false, not_qualifying_reason: "Didn't reach Discovery" }),
      ],
    });
    const r = await readPitchPeriod({});
    expect(r!.pitches).toHaveLength(1);
    expect(r!.skippedPreVerdict).toBe(0);
  });
});

describe("outcome", () => {
  it.each(["sold", "follow_up", "no_sale"])("passes %s through", async (outcome) => {
    mockDb({ pitches: [pitchRow({ outcome })] });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.outcome).toBe(outcome);
  });

  it.each(["no_contact", "undecided", null])("omits %s rather than coercing it", async (outcome) => {
    mockDb({ pitches: [pitchRow({ outcome })] });
    const r = await readPitchPeriod({});
    expect(r!.pitches[0]!.outcome).toBeUndefined();
  });
});

describe("a failed read is never an empty period", () => {
  it("returns null and logs when the pitch read fails", async () => {
    mockDb({ pitchError: { message: "connection reset" } });
    expect(await readPitchPeriod({})).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns null when the CHILD read fails, rather than an aggregate with no grades", async () => {
    // The nastiest one: real section averages beside empty per-element rates looks fully
    // populated, and the half that is missing is the actionable half.
    mockDb({ childError: { message: "timeout" } });
    expect(await readPitchPeriod({})).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns an empty period, not null, when there genuinely were no pitches", async () => {
    mockDb({ pitches: [] });
    expect(await readPitchPeriod({})).toEqual({
      pitches: [],
      skippedPreVerdict: 0,
      // Not capped: an empty read did not hit a bound, and saying it did would tell a caller
      // the period was truncated when it was simply empty.
      capped: false,
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("the output actually feeds the aggregator", () => {
  it("produces section averages that sum to avgBase", async () => {
    // The identity the launch checklist requires, end to end through the real reader rather than
    // through a hand-built fixture.
    mockDb({
      pitches: [pitchRow({ id: "p1" }), pitchRow({ id: "p2" })],
      elements: [{ pitch_id: "p1", element_id: "intro.trucks", grade: "hit" }],
    });
    const r = await readPitchPeriod({});
    const agg = aggregatePitches(r!.pitches);
    const summed =
      Math.round(Object.values(agg.sectionAverages).reduce((a, b) => a + b, 0) * 10) / 10;
    expect(summed).toBe(agg.avgBase);
  });
});

describe("the read reports its own bound", () => {
  /**
   * The bound belongs to this module: it knows the limit it applied and PostgREST's max_rows
   * behind it. Callers used to recount rows against a copied 900, which is the duplicated decision
   * this verdict exists to end.
   */
  it("says capped when the query filled its limit", async () => {
    mockDb({ pitches: Array.from({ length: 5 }, (_, i) => pitchRow({ id: `p${i}` })) });
    const read = await readPitchPeriod({ limit: 5 });
    expect(read!.capped).toBe(true);
  });

  it("does not say capped when it came back short", async () => {
    mockDb({ pitches: Array.from({ length: 4 }, (_, i) => pitchRow({ id: `p${i}` })) });
    const read = await readPitchPeriod({ limit: 5 });
    expect(read!.capped).toBe(false);
  });

  it("counts ROWS, not the mapped pitches", async () => {
    // A pitch scored before the section verdict existed is skipped AFTER the query. Comparing the
    // mapped array would under-report a read that genuinely filled its limit, and the caller would
    // be told a truncated period was complete.
    mockDb({
      pitches: Array.from({ length: 5 }, (_, i) =>
        i < 2 ? pitchRow({ id: `p${i}`, section_points: null }) : pitchRow({ id: `p${i}` })
      ),
    });
    const read = await readPitchPeriod({ limit: 5 });
    expect(read!.skippedPreVerdict).toBe(2);
    expect(read!.pitches).toHaveLength(3);
    expect(read!.capped).toBe(true);
  });
});
