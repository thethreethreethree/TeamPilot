import { describe, it, expect, vi } from "vitest";
import { getOrFreezeDayTarget, WINDOW_DAYS } from "../dayTargetData";

vi.mock("server-only", () => ({}));

/**
 * Day-target read layer (Phase 04): reads the manager goal + 30-day door/pitch counts, calls the pure engine,
 * and freezes. These pin the three paths — already-frozen (no recompute), no-goal (empty state, no freeze),
 * and compute-and-freeze — with a mocked caller-scoped db. The ratio arithmetic itself is the engine's own tests.
 */

type Counts = { doors: number; sold: number; presentations: number };

/** A minimal chainable Supabase mock. Each .from(table) returns a thenable builder; terminals resolve from opts. */
function mockDb(opts: {
  frozen?: Record<string, unknown> | null;
  goal?: number | null;
  counts?: Counts;
  onInsert?: (row: Record<string, unknown>) => void;
}) {
  const from = (table: string) => {
    let outcomeSold = false;
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = (col: string, val: unknown) => { if (col === "outcome" && val === "sold") outcomeSold = true; return builder; };
    builder.gte = chain;
    builder.lte = chain;
    builder.maybeSingle = async () => {
      if (table === "rep_day_target") return { data: opts.frozen ?? null, error: null };
      if (table === "rep_daily_sales_goal") return { data: opts.goal == null ? null : { sales_goal: opts.goal }, error: null };
      return { data: null, error: null };
    };
    builder.insert = (row: Record<string, unknown>) => ({
      then: (res: (v: unknown) => unknown) => { opts.onInsert?.(row); return Promise.resolve(res({ error: null })); },
    });
    // The count queries are awaited directly on the builder (thenable).
    (builder as { then: unknown }).then = (res: (v: unknown) => unknown) => {
      const c = opts.counts ?? { doors: 0, sold: 0, presentations: 0 };
      const count = table === "pitches" ? c.presentations : outcomeSold ? c.sold : c.doors;
      return Promise.resolve(res({ count, error: null }));
    };
    return builder;
  };
  return { from } as unknown as Parameters<typeof getOrFreezeDayTarget>[0]["db"];
}

const base = { repId: "rep1", companyId: "co1", localDate: "2026-09-10" };

describe("getOrFreezeDayTarget", () => {
  it("returns the ALREADY-FROZEN row and never recomputes/inserts", async () => {
    const insert = vi.fn();
    const db = mockDb({
      frozen: { doors_target: 80, presentations_target: 18, sold_target: 2, used_starter: false, sales_goal: 2, close_ratio: 0.11, contact_ratio: 0.23 },
      onInsert: insert,
    });
    const r = await getOrFreezeDayTarget({ ...base, db });
    expect(r.frozen).toBe(true);
    expect(r.doorsTarget).toBe(80);
    expect(r.qualified).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });

  it("no manager goal → the empty state, and nothing is frozen", async () => {
    const insert = vi.fn();
    const db = mockDb({ frozen: null, goal: null, onInsert: insert });
    const r = await getOrFreezeDayTarget({ ...base, db });
    expect(r).toMatchObject({ salesGoal: null, doorsTarget: 0, frozen: false, usedStarter: true });
    expect(insert).not.toHaveBeenCalled();
  });

  it("qualified rep: computes the target from 30-day counts and FREEZES it", async () => {
    // 30d: 200 doors, 44 presentations, 5 sales → close 5/44≈0.1136, contact 44/200=0.22.
    // goal 2 → presentations ceil(2/0.1136)=18, doors ceil(18/0.22)=82.
    const captured: Record<string, unknown>[] = [];
    const db = mockDb({ frozen: null, goal: 2, counts: { doors: 200, sold: 5, presentations: 44 }, onInsert: (r) => captured.push(r) });
    const r = await getOrFreezeDayTarget({ ...base, db });
    expect(r.frozen).toBe(false);
    expect(r.qualified).toBe(true);
    expect(r.usedStarter).toBe(false);
    expect(r.soldTarget).toBe(2);
    expect(r.presentationsTarget).toBe(18);
    expect(r.doorsTarget).toBe(82);
    // froze exactly one row, on the caller's own rep/company, for today
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ rep_id: "rep1", company_id: "co1", local_date: "2026-09-10", doors_target: 82 });
  });

  it("thin history (below the qualify threshold) → starter ratios, still frozen", async () => {
    // 8 presentations (< 10) → not qualified → starter ratios → 18 / 80 for goal 2.
    const db = mockDb({ frozen: null, goal: 2, counts: { doors: 30, sold: 1, presentations: 8 } });
    const r = await getOrFreezeDayTarget({ ...base, db });
    expect(r.qualified).toBe(false);
    expect(r.usedStarter).toBe(true);
    expect(r.doorsTarget).toBe(80);
  });

  it("WINDOW_DAYS is 30", () => expect(WINDOW_DAYS).toBe(30));
});
