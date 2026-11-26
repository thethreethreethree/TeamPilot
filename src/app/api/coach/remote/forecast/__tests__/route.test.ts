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
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/prospects", () => ({ listProspects: vi.fn(async () => st.pipeline) }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      let win: [number, number] = [0, 1e9];
      for (const m of ["select", "in", "order", "limit"]) q[m] = () => q;
      q.range = (f: number, t: number) => ((win = [f, t]), q);
      q.then = (r: (v: unknown) => unknown) => r({ data: (table === "forecast_targets" ? st.targets : []).slice(win[0], win[1] + 1), error: null });
      q.insert = async (row: Record<string, unknown>) => (st.inserts.push({ table, row }), { error: st.insertError });
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
});
