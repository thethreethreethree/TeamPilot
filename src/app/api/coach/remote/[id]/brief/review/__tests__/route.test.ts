import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/remote/:id/brief/review — the rep reviews their call's Next Meeting checklist, once; each kept item
 * becomes a Task (and the prospect's to-do). Pinned: only the call's rep; never twice; nothing created when it can't tell
 * whether it was already reviewed; a failed review save says "don't save again" (2026-11-23).
 */

const st = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  answers: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  insertErrors: {} as Record<string, { message: string } | null>,
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
const client = () => ({
  from: (table: string) => {
    const answer = st.answers[table] ?? { data: null, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => answer;
    q.insert = (row: Record<string, unknown>) => {
      st.inserts.push({ table, row });
      const err = st.insertErrors[table] ?? null;
      const res = { data: err ? null : { id: `task-${st.inserts.length}` }, error: err };
      return { select: () => ({ single: async () => res }), then: (r: (v: unknown) => unknown) => r({ error: err }) };
    };
    return q;
  },
});
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => client() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client() }));

import { POST } from "../route";

const CALL = "11111111-1111-4111-8111-111111111111";
const BRIEF = "22222222-2222-4222-8222-222222222222";
const post = (items = [{ text: "Send the price sheet", due: "2026-11-25" }]) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify({ briefId: BRIEF, items }) }) as never, { params: Promise.resolve({ id: CALL }) });
const tables = () => st.inserts.map((i) => i.table);

beforeEach(() => {
  st.session = { id: CALL, agentId: "rep-1", companyId: "co1", clientLabel: "Pat", startedAt: "2026-11-20T10:00:00Z" };
  st.answers = {
    remote_call_briefs: { data: { id: BRIEF }, error: null },
    remote_checklist_reviews: { data: null, error: null },
    remote_prospect_calls: { data: { prospect_id: "p1" }, error: null },
    profiles: { data: { full_name: "Pat Rep" }, error: null },
  };
  st.inserts = [];
  st.insertErrors = {};
});

describe("reviewing a call's checklist", () => {
  it("creates the task, links it to the prospect, then records the review", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(tables()).toEqual(["tasks", "remote_prospect_tasks", "remote_checklist_reviews"]);
    expect(st.inserts[0]!.row).toMatchObject({ title: "Send the price sheet", due_date: "2026-11-25", assignee_user_id: "rep-1" });
    expect(await res.json()).toMatchObject({ failed: 0 });
  });

  it("only the rep who took the call — a manager is refused and nothing is written", async () => {
    st.session = { ...st.session, agentId: "someone-else" };
    expect((await post()).status).toBe(403);
    expect(st.inserts).toEqual([]);
  });

  it("never twice: an existing review is a 409 before any task is created", async () => {
    st.answers.remote_checklist_reviews = { data: { kept: [] }, error: null };
    expect((await post()).status).toBe(409);
    expect(st.inserts).toEqual([]);
  });

  it("can't tell whether it was reviewed → 500, nothing created", async () => {
    st.answers.remote_checklist_reviews = { data: null, error: { message: "boom" } };
    expect((await post()).status).toBe(500);
    expect(st.inserts).toEqual([]);
  });

  it("a failed checklist read is 'try again', not 'not found'", async () => {
    st.answers.remote_call_briefs = { data: null, error: { message: "boom" } };
    const res = await post();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/try again/i);
    expect(st.inserts).toEqual([]);
  });

  it("a review that fails to save says the to-dos exist — don't save again", async () => {
    st.insertErrors.remote_checklist_reviews = { message: "boom" };
    const res = await post();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/don.t save again/i);
    expect(tables()).toContain("tasks");
  });
});
