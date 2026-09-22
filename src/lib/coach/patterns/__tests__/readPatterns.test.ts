import { describe, it, expect } from "vitest";
import { readPatterns } from "../readPatterns";
import type { Grade } from "../../pitchScore/rubric";

/**
 * The read layer.
 *
 * Two things here are easy to get wrong in a way no surface would reveal:
 *
 *   · `scored` — the field the empty state uses to tell "nothing has been missed three times"
 *     (a finding) from "nothing has looked" (an absence). They render as the same blank board.
 *   · grades fetched PER REP. A team read resolves every rep's status; pairing the wrong rep's
 *     grades with a pattern produces a confident, plausible, wrong status — a rep shown as
 *     Stalled on someone else's history.
 */

const record = (over: Record<string, unknown> = {}) => ({
  id: "pat-1",
  rep_id: "rep-1",
  item_id: "intro.trucks",
  item_kind: "element",
  first_seen: "2026-03-01T10:00:00Z",
  misses_at_detection: 3,
  applicable_at_detection: 5,
  cost_per_pitch: "2.1",
  strip_at_detection: ["missed", "missed", "hit"],
  fixed_at: null,
  ...over,
});

/**
 * A Supabase double covering the three shapes this module uses: the `patterns` select chain, the
 * `pattern_events` `.in()` chain, and the `pitch_score_elements` join used by readApplicableGrades.
 */
function db(opts: {
  patterns?: unknown[] | null;
  events?: unknown[];
  elementsByRep?: Record<string, Array<{ element_id: string; grade: Grade; recorded_at: string }>>;
}) {
  const elementQueries: string[] = [];
  const make = (table: string) => {
    const state: { rep?: string } = {};
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      in: () => chain,
      eq: (col: string, val: string) => {
        if (col === "pitch_scores.rep_id") {
          state.rep = val;
          elementQueries.push(val);
        }
        if (col === "rep_id") state.rep = val;
        return chain;
      },
      then: undefined,
    };
    if (table === "patterns") {
      // Awaited directly after .limit()/.eq() — resolve as a thenable.
      (chain as { then: unknown }).then = (res: (v: unknown) => void) =>
        res(
          opts.patterns === null
            ? { data: null, error: { message: "boom" } }
            : { data: opts.patterns ?? [], error: null }
        );
    }
    if (table === "pattern_events") {
      (chain as { then: unknown }).then = (res: (v: unknown) => void) =>
        res({ data: opts.events ?? [], error: null });
    }
    if (table === "pitch_score_elements") {
      (chain as { then: unknown }).then = (res: (v: unknown) => void) => {
        const rows = (opts.elementsByRep?.[state.rep ?? ""] ?? []).map((r) => ({
          element_id: r.element_id,
          grade: r.grade,
          points: r.grade === "hit" ? 3 : 0,
          pitch_id: `${state.rep}-${r.recorded_at}`,
          pitch_scores: { rep_id: state.rep, recorded_at: r.recorded_at },
        }));
        return res({ data: rows, error: null });
      };
    }
    return chain;
  };
  return { client: { from: make } as never, elementQueries };
}

const el = (element_id: string, grade: Grade, day: number) => ({
  element_id,
  grade,
  recorded_at: `2026-03-${String(day).padStart(2, "0")}T10:00:00Z`,
});

describe("scored — the field the empty state turns on", () => {
  it("is FALSE for a rep with no patterns and nothing scored", async () => {
    const { client } = db({ patterns: [], elementsByRep: { "rep-1": [] } });
    const r = await readPatterns({ repId: "rep-1" }, client);
    expect(r?.scored).toBe(false);
    expect(r?.patterns).toEqual([]);
  });

  it("is TRUE for a rep with no patterns who HAS been scored", async () => {
    // The distinction the whole empty state rests on: this rep is doing fine, the other one has
    // never been looked at, and both render as a blank board.
    const { client } = db({
      patterns: [],
      elementsByRep: { "rep-1": [el("intro.trucks", "hit", 1)] },
    });
    expect((await readPatterns({ repId: "rep-1" }, client))?.scored).toBe(true);
  });

  it("is TRUE whenever a pattern exists, because finding one required a score", async () => {
    const { client } = db({
      patterns: [record()],
      elementsByRep: { "rep-1": [el("intro.trucks", "missed", 1)] },
    });
    expect((await readPatterns({ repId: "rep-1" }, client))?.scored).toBe(true);
  });
});

describe("grades are fetched per rep", () => {
  it("queries once per rep that has a pattern, not once per pattern", async () => {
    const { client, elementQueries } = db({
      patterns: [
        record({ id: "a", rep_id: "rep-1", item_id: "intro.trucks" }),
        record({ id: "b", rep_id: "rep-1", item_id: "intro.who" }),
        record({ id: "c", rep_id: "rep-2", item_id: "intro.trucks" }),
      ],
      elementsByRep: { "rep-1": [], "rep-2": [] },
    });
    await readPatterns({}, client);
    expect(elementQueries.sort()).toEqual(["rep-1", "rep-2"]);
  });

  it("resolves each pattern against ITS OWN rep's history", async () => {
    // The failure this prevents is not an error — it is a plausible wrong status. rep-1 has five
    // clean pitches and rep-2 has none; crossing them marks the wrong person Fixed.
    const clean = [1, 2, 3, 4, 5].map((d) => el("intro.trucks", "hit", d));
    const missing = [1, 2, 3].map((d) => el("intro.trucks", "missed", d));
    const { client } = db({
      patterns: [
        record({ id: "a", rep_id: "rep-1" }),
        record({ id: "b", rep_id: "rep-2" }),
      ],
      elementsByRep: { "rep-1": clean, "rep-2": missing },
    });
    const r = await readPatterns({}, client);
    const byId = new Map(r!.patterns.map((x) => [x.id, x]));
    expect(byId.get("a")!.verdict.status).toBe("fixed");
    expect(byId.get("b")!.verdict.status).toBe("new");
  });
});

describe("the row it builds", () => {
  it("labels an element from the rubric and falls back to the raw id", async () => {
    const { client } = db({
      patterns: [record({ id: "a" }), record({ id: "b", item_id: "gone.retired" })],
      elementsByRep: { "rep-1": [] },
    });
    const r = await readPatterns({ repId: "rep-1" }, client);
    const byId = new Map(r!.patterns.map((x) => [x.id, x]));
    expect(byId.get("a")!.label).toBe("Trucks / neighborhood notice");
    // Ugly and true beats tidy and uninformative — "Unknown" tells a manager nothing to act on.
    expect(byId.get("b")!.label).toBe("gone.retired");
  });

  it("coerces a numeric string cost, because PostgREST returns numeric as text", async () => {
    const { client } = db({ patterns: [record({ cost_per_pitch: "2.1" })], elementsByRep: { "rep-1": [] } });
    const r = await readPatterns({ repId: "rep-1" }, client);
    expect(r!.patterns[0]!.costPerPitch).toBe(2.1);
  });

  it("takes the EARLIEST coaching event, so a later note cannot reset a stalled clock", async () => {
    const { client } = db({
      patterns: [record()],
      events: [
        { pattern_id: "pat-1", kind: "coached", created_at: "2026-03-02T10:00:00Z" },
        { pattern_id: "pat-1", kind: "note", created_at: "2026-03-19T10:00:00Z" },
      ],
      elementsByRep: { "rep-1": [] },
    });
    const r = await readPatterns({ repId: "rep-1" }, client);
    expect(r!.patterns[0]!.coachedAt).toBe("2026-03-02T10:00:00Z");
  });

  it("marks a rep_reviewed pattern, which is what AWAITING REP REVIEW counts", async () => {
    const { client } = db({
      patterns: [record()],
      events: [{ pattern_id: "pat-1", kind: "rep_reviewed", created_at: "2026-03-05T10:00:00Z" }],
      elementsByRep: { "rep-1": [] },
    });
    expect((await readPatterns({ repId: "rep-1" }, client))!.patterns[0]!.repReviewed).toBe(true);
  });

  it("returns null on a failed read rather than an empty list", async () => {
    // An empty list here becomes "no patterns" on screen, which on this board reads as praise.
    expect(await readPatterns({ repId: "rep-1" }, db({ patterns: null }).client)).toBeNull();
  });
});
