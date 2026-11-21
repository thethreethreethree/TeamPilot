import { describe, it, expect, vi, beforeEach } from "vitest";

/** POST /api/coach/remote/:id/callbacks (RSS Phase 6). Pins: a task is created through the caller's client, assigned
 *  to the call's rep with the date said and the quote; the link makes it once-only; unknown items are 404. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(async () => ({ id: "s1", companyId: "co1", agentId: "rep1", clientLabel: "Acme", startedAt: "2026-11-20T10:00:00Z" })),
}));
const st = vi.hoisted(() => ({ link: null as null | { task_id: string }, tasks: [] as unknown[], links: [] as unknown[] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: { id: "ft1", callbacks: [{ what: "Call back", due: "2026-11-26", quote: "call me Thursday", seq: 2, atMs: 65000 }] }, error: null });
      b.insert = (row: unknown) => {
        if (t === "tasks") st.tasks.push(row);
        return b;
      };
      b.single = async () => ({ data: { id: "task1" }, error: null });
      return b;
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: t === "callback_tasks" ? st.link : { full_name: "Rae" }, error: null });
      b.insert = async (row: unknown) => {
        st.links.push(row);
        return { error: null };
      };
      return b;
    },
  }),
}));

import { POST } from "../route";
const post = (body: unknown) =>
  POST(new Request("http://t/x", { method: "POST", body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) });

beforeEach(() => {
  st.link = null;
  st.tasks = [];
  st.links = [];
});

describe("POST callbacks", () => {
  it("creates the task for the rep with the date and quote, and links it", async () => {
    const res = await post({ followThroughId: "ft1", index: 0 });
    expect(await res.json()).toEqual({ taskId: "task1", already: false });
    expect(st.tasks[0]).toMatchObject({ company_id: "co1", title: "Call back", due_date: "2026-11-26", assignee_user_id: "rep1", assignee: "Rae", status: "To Do" });
    expect(String((st.tasks[0] as { description: string }).description)).toContain("call me Thursday");
    expect(st.links[0]).toMatchObject({ company_id: "co1", follow_through_id: "ft1", item_index: 0, task_id: "task1", created_by: "rep1" });
  });
  it("once only: an existing link returns its task without creating another", async () => {
    st.link = { task_id: "old" };
    expect(await (await post({ followThroughId: "ft1", index: 0 })).json()).toEqual({ taskId: "old", already: true });
    expect(st.tasks).toEqual([]);
  });
  it("an index past the list is 404", async () => {
    expect((await post({ followThroughId: "ft1", index: 3 })).status).toBe(404);
  });
});
