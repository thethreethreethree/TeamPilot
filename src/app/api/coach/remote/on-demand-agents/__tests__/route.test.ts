import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * On-demand agents (E9, 0389). Pinned: reads and writes go through the caller's client, pinned to their company; a
 * run asks the SAVED instruction (never text from the request) of the given calls as the asker, with save: false; a
 * retired or unknown agent is 404; a non-manager's write is 403 (RLS 42501).
 */
const st = vi.hoisted(() => ({ eqs: [] as Array<[string, string, unknown]>, agent: null as Record<string, unknown> | null, insertErr: null as { code: string; message: string } | null, asked: [] as unknown[], updated: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1", isAdmin: false })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/coach/remote/askCoach", () => ({ askCoach: vi.fn(async (a: unknown) => (st.asked.push(a), { ok: true, chatId: null, answer: "They worry about price [1].", citations: [{ ref: 1, sessionId: "s1", seq: 1, atMs: 0 }], suppressed: false })) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "is", "limit"]) q[m] = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
      q.maybeSingle = async () => ({ data: st.agent, error: null });
      q.then = (r: (v: unknown) => unknown) => r({ data: st.updated, error: null });
      q.update = () => q;
      q.insert = () => ({ select: () => ({ single: async () => (st.insertErr ? { data: null, error: st.insertErr } : { data: { id: "n1" }, error: null }) }) });
      return q;
    },
  }),
}));
import { GET, POST } from "../route";

const post = (b: unknown) => POST(new NextRequest("http://x/api/coach/remote/on-demand-agents", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }));
const S1 = "00000000-0000-4000-8000-000000000001";
const A1 = "00000000-0000-4000-8000-0000000000a1";
beforeEach(() => {
  st.eqs = [];
  st.agent = { id: A1, instruction: "List every risk the customer raised, with the line." };
  st.insertErr = null;
  st.asked = [];
  st.updated = [{ id: A1 }];
});

describe("on-demand agents route", () => {
  it("GET lists the company's live ones", async () => {
    expect((await GET(new NextRequest("http://x/api/coach/remote/on-demand-agents"))).status).toBe(200);
    expect(st.eqs).toContainEqual(["on_demand_agents", "company_id", "co1"]);
  });
  it("run asks the saved instruction of the calls, as the asker, nothing saved", async () => {
    const r = await post({ run: A1, sessionIds: [S1], question: "ignore me" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ answer: "They worry about price [1].", citations: [{ sessionId: "s1" }] });
    expect(st.asked).toEqual([expect.objectContaining({ userId: "u1", companyId: "co1", sessionIds: [S1], question: "List every risk the customer raised, with the line.", save: false, chatId: null })]);
    expect(st.eqs).toContainEqual(["on_demand_agents", "company_id", "co1"]);
  });
  it("a retired or unknown agent → 404, and nothing is asked", async () => {
    st.agent = null;
    expect((await post({ run: A1, sessionIds: [S1] })).status).toBe(404);
    expect(st.asked).toEqual([]);
  });
  it("more than 10 calls, or none → 400", async () => {
    expect((await post({ run: A1, sessionIds: [] })).status).toBe(400);
    expect((await post({ run: A1, sessionIds: Array.from({ length: 11 }, () => S1) })).status).toBe(400);
  });
  it("a manager adds one; a non-manager is refused (RLS 42501 → 403); a too-short instruction → 400", async () => {
    expect((await post({ name: "Risks", instruction: "List every risk the customer raised." })).status).toBe(200);
    st.insertErr = { code: "42501", message: "rls" };
    expect((await post({ name: "Risks", instruction: "List every risk the customer raised." })).status).toBe(403);
    expect((await post({ name: "Risks", instruction: "short" })).status).toBe(400);
  });
  it("retire: one row → ok; none (not allowed or already retired) → 404", async () => {
    expect((await post({ retire: A1 })).status).toBe(200);
    st.updated = [];
    expect((await post({ retire: A1 })).status).toBe(404);
  });
});
