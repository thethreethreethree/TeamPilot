import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/course-assignments (F17.1, 2026-11-26): a rep sees their courses with progress from the CURRENT
 * lessons; only that rep marks a lesson done, and only one in the current version; a manager's team view asks the tree
 * and an unanswerable tree check is a 503.
 */
const st = vi.hoisted(() => ({
  who: { userId: "rep1", companyId: "co1" },
  manager: false,
  tree: ["rep1", "rep2"] as string[] | null,
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  inserts: [] as Array<[string, unknown]>,
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => st.who) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => (st.manager ? st.who : null)) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterRepsChecked: vi.fn(async (_r: unknown, ids: string[]) => (st.tree === null ? null : ids.filter((i) => st.tree!.includes(i)))) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.eq = (k: string, v: unknown) => (filters.push((r) => r[k] === v), q);
      q.in = (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q);
      const rows = () => (st.tables[t] ?? []).filter((r) => filters.every((f) => f(r)));
      q.range = async (from: number) => ({ data: from > 0 ? [] : rows(), error: null });
      q.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: rows(), error: null }));
      q.insert = async (v: unknown) => {
        st.inserts.push([t, v]);
        return { error: null };
      };
      return q;
    },
  }),
}));

import { GET, PUT } from "../route";
const S = (v: number, p: number, uid: string) => ({ company_id: "co1", course_id: "k1", version: v, position: p, step_uid: uid, title: uid, body: "b", id: v * 10 + p });
const put = (body: unknown) => PUT(new Request("http://t/x", { method: "PUT", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  st.who = { userId: "rep1", companyId: "co1" };
  st.manager = false;
  st.tree = ["rep1", "rep2"];
  st.inserts = [];
  st.tables = {
    training_course_assignments: [
      { id: "a1", company_id: "co1", course_id: "k1", rep_id: "rep1", assigned_by: "mgr1", due_at: "2999-01-01T00:00:00Z", created_at: "2026-11-26T00:00:00Z" },
      { id: "a2", company_id: "co1", course_id: "k1", rep_id: "rep9", assigned_by: "mgr1", due_at: "2999-01-01T00:00:00Z", created_at: "2026-11-26T00:00:00Z" },
    ],
    training_course_steps: [S(1, 1, "old"), S(2, 1, "u1"), S(2, 2, "u2")],
    training_courses: [{ id: "k1", company_id: "co1", title: "Discovery", summary: null, retired_at: null }],
    training_step_completions: [{ id: 1, company_id: "co1", assignment_id: "a1", step_uid: "u1" }, { id: 2, company_id: "co1", assignment_id: "a1", step_uid: "old" }],
    profiles: [{ id: "rep1", company_id: "co1", full_name: "Rae" }, { id: "mgr1", company_id: "co1", full_name: "Max" }],
  };
});

describe("course assignments", () => {
  it("a rep sees their own course, its current lessons, and progress that ignores a removed lesson", async () => {
    const body = await (await GET(new Request("http://t/x") as never)).json();
    expect(body.assignments).toHaveLength(1);
    const a = body.assignments[0];
    expect(a).toMatchObject({ title: "Discovery", done: 1, total: 2, state: "in_progress", assignedByName: "Max" });
    expect(a.steps.map((s: { uid: string; done: boolean }) => [s.uid, s.done])).toEqual([["u1", true], ["u2", false]]);
  });
  it("a manager's team view keeps the tree's reps, without lesson text; a failed tree check is a 503", async () => {
    st.who = { userId: "mgr1", companyId: "co1" };
    st.manager = true;
    const body = await (await GET(new Request("http://t/x?team=1") as never)).json();
    expect(body.assignments.map((a: { repId: string }) => a.repId)).toEqual(["rep1"]);
    expect(body.assignments[0].steps).toBeUndefined();
    st.tree = null;
    expect((await GET(new Request("http://t/x?team=1") as never)).status).toBe(503);
  });
  it("only the rep marks a lesson done, and only a lesson in the current version", async () => {
    expect((await put({ assignmentId: "a1", stepUid: "u2" })).status).toBe(200);
    expect(st.inserts).toEqual([["training_step_completions", { company_id: "co1", assignment_id: "a1", step_uid: "u2", rep_id: "rep1" }]]);
    expect((await put({ assignmentId: "a1", stepUid: "old" })).status).toBe(409);
    expect((await put({ assignmentId: "a2", stepUid: "u2" })).status).toBe(404); // someone else's course
    expect(st.inserts).toHaveLength(1);
  });
  it("a practice step (0357) is done from the rep's own attempt, opens its practice, and can't be ticked by hand", async () => {
    st.tables.training_course_steps = [S(2, 1, "u1"), { ...S(2, 3, "p1"), kind: "practice", scenario_id: "sc1", body: "" }];
    st.tables.training_scenarios = [{ id: "sc1", company_id: "co1", pass_score: 70 }];
    st.tables.training_assignments = [{ id: "ta1", company_id: "co1", rep_id: "rep1", scenario_id: "sc1", due_at: "2999-01-01T00:00:00Z" }];
    st.tables.training_attempts = [{ id: 1, company_id: "co1", assignment_id: "ta1", score: 60, applied: true, passed: false, created_at: "2026-11-26T00:00:00Z" }];
    let a = (await (await GET(new Request("http://t/x") as never)).json()).assignments[0];
    expect(a.steps[1]).toMatchObject({ uid: "p1", kind: "practice", done: false, practiceAssignmentId: "ta1", practiceState: "not_passed_yet" });
    expect(a).toMatchObject({ done: 1, total: 2 });
    st.tables.training_attempts.push({ id: 2, company_id: "co1", assignment_id: "ta1", score: 80, applied: true, passed: true, created_at: "2026-11-26T01:00:00Z" });
    a = (await (await GET(new Request("http://t/x") as never)).json()).assignments[0];
    expect(a).toMatchObject({ done: 2, total: 2, state: "done" });
    expect((await put({ assignmentId: "a1", stepUid: "p1" })).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });
});
