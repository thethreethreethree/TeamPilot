import { describe, it, expect } from "vitest";
import { assignPractice } from "../coursePractice";

/** 0357: a course's practice reaches only reps without it, only for live scenarios, assigned by who gave the course. */
function db(tables: Record<string, Array<Record<string, unknown>>>, inserts: unknown[]) {
  return {
    from: (t: string) => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.eq = (k: string, v: unknown) => (filters.push((r) => r[k] === v), q);
      q.in = (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q);
      const rows = () => (tables[t] ?? []).filter((r) => filters.every((f) => f(r)));
      q.range = async (from: number) => ({ data: from > 0 ? [] : rows(), error: null });
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: rows(), error: null }));
      q.insert = async (v: unknown) => (inserts.push(v), { error: null });
      return q;
    },
  } as never;
}

describe("assignPractice", () => {
  it("skips retired scenarios and reps who already have one; assigned_by is per rep", async () => {
    const inserts: unknown[] = [];
    const tables = {
      training_scenarios: [{ id: "s1", company_id: "co1", retired_at: null }, { id: "s2", company_id: "co1", retired_at: "2026-11-01T00:00:00Z" }],
      training_assignments: [{ id: "x", company_id: "co1", rep_id: "r1", scenario_id: "s1" }],
    };
    const r = await assignPractice(db(tables, inserts), "co1", { scenarioIds: ["s1", "s2"], reps: [{ repId: "r1", dueAt: "D", by: "m1" }, { repId: "r2", dueAt: "D", by: "m2" }] });
    expect(r).toBe("ok");
    expect(inserts).toEqual([[{ company_id: "co1", scenario_id: "s1", rep_id: "r2", assigned_by: "m2", due_at: "D" }]]);
  });
});
