import { describe, it, expect, vi, beforeEach } from "vitest";

/** GET /api/coach/remote/prospects/:pid — a failed read is "couldn't load", never an empty prospect (2026-11-23). */

const answers = vi.hoisted(() => ({} as Record<string, { data: unknown; error: { message: string } | null }>));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const answer = answers[table] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => answer;
      q.then = (res: (v: unknown) => unknown) => res(answer);
      return q;
    },
  }),
}));

import { GET } from "../route";

const PID = "11111111-1111-4111-8111-111111111111";
const call = () => GET(new Request(`http://x/api/coach/remote/prospects/${PID}`) as never, { params: Promise.resolve({ pid: PID }) });
const boom = { data: null, error: { message: "boom" } };

beforeEach(() => {
  for (const k of Object.keys(answers)) delete answers[k];
  answers.remote_prospects_current = { data: { id: PID, name: "Pat" }, error: null };
  answers.remote_prospect_calls = { data: [{ session_id: "s1", created_at: "2026-11-20" }], error: null };
  answers.remote_prospect_tasks = { data: [{ task_id: "t1" }], error: null };
  answers.coaching_sessions = { data: [{ id: "s1", client_label: "Pat", context: "phone", started_at: "2026-11-20", outcome: null }], error: null };
  answers.tasks = { data: [{ id: "t1", title: "Call back", status: null, due_date: null }], error: null };
});

describe("one prospect", () => {
  it("loads its calls and to-dos", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calls.map((c: { id: string }) => c.id)).toEqual(["s1"]);
    expect(body.todos.map((t: { id: string }) => t.id)).toEqual(["t1"]);
  });

  for (const table of ["coaching_sessions", "tasks"]) {
    it(`says it couldn't load — not 'no ${table === "tasks" ? "to-dos" : "calls"}' — when ${table} fails`, async () => {
      answers[table] = boom;
      const res = await call();
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/couldn't load this prospect/i);
    });
  }
});
