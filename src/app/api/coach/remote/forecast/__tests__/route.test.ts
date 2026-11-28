import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/forecast (0376; Gong M22). Pinned: a submission stores the caller's own open deals closing in that
 * quarter, read on the server (never sent by the page); a pipeline that can't be read saves nothing; a target the
 * policy refuses is a 403 that says who may; the latest target per person wins.
 */
const st = vi.hoisted(() => ({
  pipeline: [] as unknown[] | null,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  insertError: null as { code?: string; message: string } | null,
  targets: [] as unknown[],
  isAdmin: false,
  due: 1 as number | null,
  updates: [] as Array<{ table: string; row: Record<string, unknown>; eqs: Array<[string, unknown]> }>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1", isAdmin: st.isAdmin })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// 0395: the snapshot also reads the caller's co-owned deals and splits (none here unless a test sets them).
const co = vi.hoisted(() => ({ ids: [] as string[], deals: [] as unknown[], splits: [] as unknown[] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: co.ids, error: null }),
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "range"]) q[m] = () => q;
      q.limit = async () => ({ data: co.splits, error: null });
      return q;
    },
  }),
}));
vi.mock("@/lib/coach/remote/prospects", () => ({ listProspects: vi.fn(async (_db: unknown, repId?: string) => (repId ? st.pipeline : co.deals)) }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      let win: [number, number] = [0, 1e9];
      for (const m of ["select", "in", "order", "limit"]) q[m] = () => q;
      q.range = (f: number, t: number) => ((win = [f, t]), q);
      q.then = (r: (v: unknown) => unknown) => r({ data: (table === "forecast_targets" ? st.targets : []).slice(win[0], win[1] + 1), error: null });
      q.insert = async (row: Record<string, unknown>) => (st.inserts.push({ table, row }), { error: st.insertError });
      const eqs: Array<[string, unknown]> = [];
      q.eq = (c: string, v: unknown) => (eqs.push([c, v]), q);
      q.maybeSingle = async () => ({ data: table === "companies" ? { forecast_due_weekday: st.due } : null, error: null });
      q.update = (row: Record<string, unknown>) => {
        const u = { table, row, eqs: [] as Array<[string, unknown]> };
        st.updates.push(u);
        const w: Record<string, unknown> = { eq: (c: string, v: unknown) => (u.eqs.push([c, v]), Promise.resolve({ error: null })) };
        return w;
      };
      return q;
    },
  }),
}));
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
const post = (b: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => {
  st.pipeline = [];
  st.inserts = [];
  st.insertError = null;
  st.targets = [];
  st.isAdmin = false;
  st.due = 1;
  st.updates = [];
});

describe("forecast", () => {
  it("a submission stores the caller's own open deals closing in the quarter, read on the server", async () => {
    st.pipeline = [
      { id: "d1", status: "open", amount: 500, closeDate: "2026-11-30" },
      { id: "d2", status: "open", amount: 900, closeDate: "2027-01-15" }, // next quarter
      { id: "d3", status: "won", amount: 100, closeDate: "2026-11-01" },
      { id: "d4", status: "open", amount: null, closeDate: "2026-12-01" },
    ];
    const j = await (await post({ kind: "submit", period: "2026-Q4", category: "commit", amount: 1200, note: " gut " }) /* a note is ignored: not taken since 0381 */).json();
    expect(j).toEqual({ ok: true, deals: 2 });
    expect(st.inserts[0]).toEqual({ table: "forecast_submissions", row: { company_id: "co1", user_id: "u1", period: "2026-Q4", category: "commit", amount: 1200, deals: [{ id: "d1", amount: 500 }, { id: "d4", amount: null }] } });
  });
  it("a pipeline that can't be read saves nothing", async () => {
    st.pipeline = null;
    expect((await post({ kind: "submit", period: "2026-Q4", category: "commit", amount: 1 })).status).toBe(500);
    expect(st.inserts).toEqual([]);
  });
  it("a target the policy refuses says who may (403); a bad quarter never reaches the database", async () => {
    st.insertError = { code: "42501", message: "rls" };
    expect((await post({ kind: "target", period: "2026-Q4", userId: "11111111-1111-4111-8111-111111111111", amount: 5000 })).status).toBe(403);
    expect((await post({ kind: "submit", period: "2026-Q5", category: "commit", amount: 1 })).status).toBe(400);
  });
  it("GET: the latest target per person and quarter", async () => {
    st.targets = [{ user_id: "a", period: "2026-Q4", amount: 100 }, { user_id: "a", period: "2026-Q4", amount: 250 }];
    const j = await (await GET(new NextRequest("http://x/api?period=2026-Q4"))).json();
    expect(j.targets).toEqual([{ userId: "a", period: "2026-Q4", amount: 250 }]);
  });
  it("reads every target page: the latest one past the first 1,000 rows still wins (review 2026-11-27)", async () => {
    st.targets = [...Array.from({ length: 1000 }, () => ({ user_id: "a", period: "2026-Q4", amount: 1 })), { user_id: "a", period: "2026-Q4", amount: 999 }];
    const j = await (await GET(new NextRequest("http://x/api?period=2026-Q4"))).json();
    expect(j.targets).toEqual([{ userId: "a", period: "2026-Q4", amount: 999 }]);
  });
  it("a team target (0386) is kept apart from the manager's own target, and POST stores the flag", async () => {
    st.targets = [{ user_id: "m", period: "2026-Q4", amount: 500, for_team: false }, { user_id: "m", period: "2026-Q4", amount: 9000, for_team: true }];
    const j = await (await GET(new NextRequest("http://x/api?period=2026-Q4"))).json();
    expect(j.targets).toEqual([{ userId: "m", period: "2026-Q4", amount: 500 }, { userId: "m", period: "2026-Q4", amount: 9000, team: true }]);
    // The caller's own team (a team target is only ever the caller's): the caller is this id here.
    const { resolveApiAuth } = await import("@/lib/api/resolveApiAuth");
    vi.mocked(resolveApiAuth).mockResolvedValueOnce({ userId: "11111111-1111-4111-8111-111111111111", companyId: "co1" } as never);
    await post({ kind: "target", period: "2026-Q4", userId: "11111111-1111-4111-8111-111111111111", amount: 9500, team: true });
    expect(st.inserts.at(-1)!.row).toMatchObject({ for_team: true, amount: 9500 });
  });
  it("a team target is only for the caller's own team (review)", async () => {
    const r = await post({ kind: "target", period: "2026-Q4", userId: "22222222-2222-4222-8222-222222222222", amount: 1, team: true });
    expect(r.status).toBe(400);
  });
  it("the due day (0391): GET says it and whether you may change it; only an admin sets it, pinned to their company", async () => {
    st.due = 3;
    const g = await (await GET(new NextRequest("http://x/api?period=2026-Q4"))).json();
    expect(g).toMatchObject({ dueWeekday: 3, canSetDue: false });
    expect((await post({ kind: "due_day", weekday: 5 })).status).toBe(403);
    expect(st.updates).toEqual([]);
    st.isAdmin = true;
    expect((await post({ kind: "due_day", weekday: 5 })).status).toBe(200);
    expect(st.updates).toEqual([{ table: "companies", row: { forecast_due_weekday: 5 }, eqs: [["id", "co1"]] }]);
    expect((await post({ kind: "due_day", weekday: 7 })).status).toBe(400);
  });
  it("the snapshot includes deals the caller co-owns, at their share (0395)", async () => {
    st.pipeline = [{ id: "d1", repId: "u1", status: "open", amount: 500, closeDate: "2026-11-30" }];
    co.ids = ["d2"];
    co.deals = [{ id: "d2", repId: "someone", status: "open", amount: 1000, closeDate: "2026-12-05" }];
    co.splits = [{ prospect_id: "d2", shares: [{ user_id: "someone", pct: 70 }, { user_id: "u1", pct: 30 }] }];
    expect((await post({ kind: "submit", period: "2026-Q4", category: "commit", amount: 800 })).status).toBe(200);
    const row = st.inserts.find((x) => x.table === "forecast_submissions")!.row as { deals: unknown[] };
    expect(row.deals).toEqual([{ id: "d1", amount: 500 }, { id: "d2", amount: 300 }]);
    co.ids = [];
    co.deals = [];
    co.splits = [];
  });
});
