import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/courses (F17.1, 2026-11-26): managers only; saving lessons writes a NEW version (never an edit);
 * two saves at once — the second is told to reload; a course whose lessons fail to save is retired, never assignable.
 */
const st = vi.hoisted(() => ({
  manager: true,
  top: [] as Array<{ version: number }>,
  stepsError: null as { code?: string; message: string } | null,
  inserts: [] as Array<[string, unknown]>,
  updates: [] as Array<[string, unknown]>,
  data: {} as Record<string, unknown[]>,
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => (st.manager ? { userId: "mgr1", companyId: "co1" } : null)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "is"]) q[m] = () => q;
      q.limit = async () => ({ data: st.top, error: null });
      q.maybeSingle = async () => ({ data: t === "training_courses" ? { id: "k1", retired_at: null } : null, error: null });
      q.insert = (v: unknown) => {
        st.inserts.push([t, v]);
        if (t === "training_courses") return { select: () => ({ single: async () => ({ data: { id: "k-new" }, error: null }) }) };
        return Promise.resolve({ error: st.stepsError });
      };
      q.update = (v: unknown) => {
        st.updates.push([t, v]);
        return q;
      };
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(res({ data: st.data[t] ?? [{ id: "k1" }], error: null }));
      q.range = async (from: number) => ({ data: from > 0 ? [] : (st.data[t] ?? []), error: null });
      return q;
    },
  }),
}));

import { POST, PUT } from "../route";
const call = (fn: typeof POST, body: unknown) => fn(new Request("http://t/x", { method: "POST", body: JSON.stringify(body) }) as never);
const U1 = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  st.manager = true;
  st.top = [];
  st.stepsError = null;
  st.inserts = [];
  st.updates = [];
  st.data = {};
});

describe("courses", () => {
  it("managers only", async () => {
    st.manager = false;
    expect((await call(POST, { title: "x", steps: [{ title: "a", body: "b" }] })).status).toBe(403);
  });
  it("a new course is version 1; lessons are checked", async () => {
    expect((await call(POST, { title: "Discovery", steps: [] })).status).toBe(400);
    const r = await call(POST, { title: "Discovery", steps: [{ title: "Open", body: "Ask first" }] });
    expect(await r.json()).toEqual({ id: "k-new", version: 1 });
    const [, steps] = st.inserts.find(([t]) => t === "training_course_steps")!;
    expect(steps).toMatchObject([{ course_id: "k-new", version: 1, position: 1, title: "Open", body: "Ask first", kind: "lesson" }]);
  });
  it("saving writes the next version and keeps a lesson's uid", async () => {
    st.top = [{ version: 3 }];
    const r = await call(PUT, { courseId: "k1", steps: [{ uid: U1, title: "Open", body: "b" }] });
    expect(await r.json()).toEqual({ id: "k1", version: 4, practiceAssigned: true });
    expect(st.inserts[0]![1]).toMatchObject([{ version: 4, step_uid: U1 }]);
    expect(st.updates).toEqual([]); // never an edit
  });
  it("two saves at once: the second is a 409; failed lessons on create retire the empty course", async () => {
    st.stepsError = { code: "23505", message: "dup" };
    expect((await call(PUT, { courseId: "k1", steps: [{ title: "a", body: "b" }] })).status).toBe(409);
    st.stepsError = { message: "boom" };
    expect((await call(POST, { title: "Discovery", steps: [{ title: "a", body: "b" }] })).status).toBe(500);
    expect(st.updates[0]![0]).toBe("training_courses");
    expect(st.updates[0]![1]).toHaveProperty("retired_at");
  });
  it("a practice step needs a live scenario, and a new one reaches the reps already taking the course, from the manager who gave it (0357)", async () => {
    const SC = "00000000-0000-4000-8000-0000000000aa";
    st.data.training_scenarios = [];
    expect((await call(PUT, { courseId: "k1", steps: [{ kind: "practice", title: "Try", scenarioId: SC }] })).status).toBe(400);
    st.data.training_scenarios = [{ id: SC, retired_at: null }];
    st.data.training_course_assignments = [{ rep_id: "rep1", due_at: "2999-01-01T00:00:00Z", assigned_by: "mgr9", id: "a1" }];
    st.data.training_assignments = [];
    st.top = [{ version: 1 }];
    const r = await call(PUT, { courseId: "k1", steps: [{ kind: "practice", title: "Try", scenarioId: SC }] });
    expect(await r.json()).toMatchObject({ version: 2, practiceAssigned: true });
    const given = st.inserts.find(([t]) => t === "training_assignments");
    expect(given?.[1]).toEqual([{ company_id: "co1", scenario_id: SC, rep_id: "rep1", assigned_by: "mgr9", due_at: "2999-01-01T00:00:00Z" }]);
  });
  it("a lesson's library call must be in a company folder and not removed (0359)", async () => {
    const LI = "00000000-0000-4000-8000-0000000000bb";
    st.data.library_items = [{ id: LI, folder_id: "f1" }];
    st.data.library_item_removals = [];
    st.data.library_folders = [{ id: "f1", is_company: false }];
    expect((await call(PUT, { courseId: "k1", steps: [{ title: "Watch", body: "b", libraryItemId: LI }] })).status).toBe(400);
    st.data.library_folders = [{ id: "f1", is_company: true }];
    const r = await call(PUT, { courseId: "k1", steps: [{ title: "Watch", body: "b", libraryItemId: LI, linkUrl: "https://loom.com/x" }] });
    expect(r.status).toBe(200);
    expect(st.inserts.find(([t]) => t === "training_course_steps")?.[1]).toMatchObject([{ library_item_id: LI, link_url: "https://loom.com/x" }]);
    st.data.library_item_removals = [{ item_id: LI }];
    expect((await call(PUT, { courseId: "k1", steps: [{ title: "Watch", body: "b", libraryItemId: LI }] })).status).toBe(400);
  });
});
