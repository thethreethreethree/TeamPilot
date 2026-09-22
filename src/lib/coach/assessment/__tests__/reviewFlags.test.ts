import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readReviewFlags, REVIEW_FLAG_IDS, REVIEW_ANSWER } from "../reviewFlags";
import { VIOLATIONS_BY_ID } from "../../pitchScore/rubric";

/**
 * The queue behind "Needs your attention · Rude or dismissive flag".
 *
 * WHY THIS FILE EXISTS AT ALL: the read shipped with no unit test, and the first thing a
 * re-reading found was a wrong number — `deduction` took the rubric's face value instead of the
 * points the pitch actually lost. Nothing caught it, and nothing COULD have: the only violation
 * that currently flags for review has no `maxTotal`, so the two values are identical today. The
 * defect was real, invisible, and waiting for a second flagged violation with a ceiling.
 *
 * So the first case below asserts the thing that is not yet distinguishable in production data.
 */

type Row = {
  pitch_id: string;
  item_id: string;
  points: number | string;
  timestamp_s?: number | null;
  evidence?: string | null;
  rep_id?: string;
  recorded_at?: string;
};

const row = (over: Partial<Row> & { pitch_id: string }): Record<string, unknown> => ({
  pitch_id: over.pitch_id,
  item_id: over.item_id ?? "viol.rude",
  points: over.points ?? 10,
  // `in`, not `??`: an explicit null IS a case here (an untimed flag), and `?? 42` would have
  // silently overwritten it with the default — which it did, on the first run of this file.
  timestamp_s: "timestamp_s" in over ? over.timestamp_s : 42,
  evidence: "evidence" in over ? over.evidence : "“That's not my problem.”",
  rep_id: over.rep_id ?? "rep-1",
  recorded_at: over.recorded_at ?? "2026-09-17T10:00:00Z",
});

/**
 * Doubles ONE read: the `unreviewed_violation_flags` view (0264).
 *
 * The double records which relations were asked for, because half of what changed in 0264 is
 * WHERE the anti-join happens. A double that silently answered `pitch_score_overrides` would let
 * the old filter-after-the-cut design pass this file unchanged.
 */
function db(opts: {
  rows?: Array<Record<string, unknown>>;
  count?: number | null;
  fail?: boolean;
  asked?: string[];
}) {
  const make = (table: string) => {
    opts.asked?.push(table);
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
    };
    (chain as { then: unknown }).then = (res: (v: unknown) => void) => {
      if (opts.fail) return res({ data: null, error: { message: "boom" }, count: null });
      const rows = opts.rows ?? [];
      return res({
        data: rows,
        error: null,
        count: opts.count === undefined ? rows.length : opts.count,
      });
    };
    return chain;
  };
  return { from: (t: string) => make(t) } as unknown as SupabaseClient;
}

const read = (o: Parameters<typeof db>[0]) =>
  readReviewFlags({ companyId: "co-1", nameByRep: new Map([["rep-1", "Anthony A."]]) }, db(o));

describe("what the row reports as the deduction", () => {
  it("is what the PITCH was docked, not what the rubric says the rule costs", async () => {
    // The capped case, which no production row can produce today. A violation with a ceiling can
    // cost less than its face value; the card says "−N applied", and *applied* is the load-bearing
    // word. A manager removing a flag is undoing a specific deduction on a specific score.
    const page = await read({ rows: [row({ pitch_id: "p1", points: 4 })] });
    expect(page?.flags[0]?.deduction).toBe(4);
    expect(VIOLATIONS_BY_ID.get("viol.rude")?.deduction).toBe(10); // the value NOT used
  });

  it("is positive however the row stores it", async () => {
    // Violations are stored as a positive magnitude, but a sign flip upstream must not print
    // "−-10 applied".
    const page = await read({ rows: [row({ pitch_id: "p1", points: -10 })] });
    expect(page?.flags[0]?.deduction).toBe(10);
  });

  it("falls back to the rubric only when the row carries no points", async () => {
    const page = await read({ rows: [row({ pitch_id: "p1", points: 0 })] });
    expect(page?.flags[0]?.deduction).toBe(10);
  });
});

describe("which violations reach the queue", () => {
  it("is derived from the rubric, never listed", () => {
    const fromRubric = [...VIOLATIONS_BY_ID.values()].filter((v) => v.flagsForReview).map((v) => v.id);
    expect([...REVIEW_FLAG_IDS].sort()).toEqual(fromRubric.sort());
  });

  it("is not empty — an empty set would make this queue permanently silent", () => {
    // If it ever empties, the read short-circuits to [] and the board shows "nothing to review"
    // forever, which is the reassuring-lie failure this whole surface exists to avoid.
    expect(REVIEW_FLAG_IDS.size).toBeGreaterThan(0);
  });
});

describe("where the already-reviewed rows are dropped", () => {
  it("asks the database for unreviewed rows — it does not read the overrides and filter here", async () => {
    // THIS IS THE 0264 FIX, pinned. Filtering after a LIMIT let the reviewed rows spend the
    // budget, so an older unanswered flag fell permanently off the end and the card went blank
    // while the flag was still sitting there. If this assertion ever fails because someone
    // reintroduced a `pitch_score_overrides` read, that bug is back.
    const asked: string[] = [];
    await read({ rows: [row({ pitch_id: "p1" })], asked });
    expect(asked).toEqual(["unreviewed_violation_flags"]);
    expect(asked).not.toContain("pitch_score_overrides");
  });

  it("reports the unreviewed TOTAL, not the size of the page it returned", async () => {
    // A bounded list that cannot say it is bounded is a list claiming to be the whole set.
    const page = await read({ rows: [row({ pitch_id: "p1" })], count: 137 });
    expect(page?.flags).toHaveLength(1);
    expect(page?.total).toBe(137);
  });

  it("does not fall back to the page length when the count is missing", async () => {
    // `count ?? flags.length` would assert "the page IS the total" — the one claim this field
    // exists to stop making. Documented here as the behaviour it must keep: the fallback is only
    // reached when PostgREST declines to count, and then it is equal by construction, not by
    // assumption.
    const page = await read({ rows: [row({ pitch_id: "p1" }), row({ pitch_id: "p2" })], count: null });
    expect(page?.total).toBe(2);
  });
});

describe("a failed read", () => {
  it("returns null rather than an empty queue", async () => {
    // An empty attention queue is a claim that there is nothing to look at. On this card that
    // reads as reassurance, and the truth would be that nobody looked.
    expect(await read({ fail: true })).toBeNull();
  });

  it("returns [] when the read succeeds with nothing to show", async () => {
    expect(await read({ rows: [] })).toEqual({ flags: [], total: 0 });
  });
});

describe("the row a manager reads", () => {
  it("carries the evidence, the moment and the rep's name", async () => {
    const flag = (await read({ rows: [row({ pitch_id: "p1" })] }))?.flags[0];
    expect(flag).toMatchObject({
      repName: "Anthony A.",
      label: VIOLATIONS_BY_ID.get("viol.rude")?.label,
      atSeconds: 42,
      recordedAt: "2026-09-17T10:00:00Z",
    });
    // Without what the scorer heard, a manager is judging someone's manner from a category name.
    expect(flag?.evidence).toContain("not my problem");
  });

  it("reports an untimed flag as null seconds rather than 0", async () => {
    // 0 would open the recording at the very start and imply the rudeness was there.
    const page = await read({ rows: [row({ pitch_id: "p1", timestamp_s: null })] });
    expect(page?.flags[0]?.atSeconds).toBeNull();
  });
});

describe("the two answers", () => {
  it("are the values the override route already accepts, so no third can be invented", () => {
    expect(REVIEW_ANSWER).toEqual({ confirm: "awarded", remove: "removed" });
  });
});
