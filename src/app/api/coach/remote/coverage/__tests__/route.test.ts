import { describe, it, expect, vi, beforeEach } from "vitest";

/** GET /api/coach/remote/coverage (F10.11): managers only; every read on the manager's own client (so the tree and
 *  hidden calls apply), company-pinned; shares out of the period's finished phone/video calls; a failed read is a 500. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "mgr", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const st = vi.hoisted(() => ({
  eqs: [] as Array<[string, string, unknown]>,
  ins: [] as Array<[string, string, unknown]>,
  fail: null as string | null,
  rows: {} as Record<string, unknown[]>,
}));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "neq", "gte", "order"]) q[m] = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([t, c, v]), q);
      q.in = (c: string, v: unknown) => (st.ins.push([t, c, v]), q);
      const result = () => (st.fail === t ? { data: null, error: { message: "boom" } } : { data: st.rows[t] ?? [], error: null });
      q.range = async (from: number) => (from > 0 ? { data: [], error: null } : result());
      q.then = (res: (v: unknown) => unknown) => res(result());
      return q;
    },
  }),
}));
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

const get = (days = "30") => GET(new Request(`http://x/api/coach/remote/coverage?days=${days}`) as never);
beforeEach(() => {
  st.eqs = [];
  st.ins = [];
  st.fail = null;
  st.rows = {
    coaching_sessions: ["c1", "c2", "c3", "c4"].map((id) => ({ id })),
    keyword_trackers: [{ id: "t1", name: "Pricing", active: true }],
    tracker_hits: [{ tracker_id: "t1", session_id: "c1" }, { tracker_id: "t1", session_id: "c2" }],
    events: [
      { subject: "sales_session:c1", payload: { intel: { topics: ["Budget"] } }, created_at: "2026-11-20T10:00:00Z" },
      { subject: "sales_session:c1", payload: { intel: { topics: ["Stale"] } }, created_at: "2026-11-24T10:00:00Z" },
    ],
  };
});

describe("GET coverage (F10.11)", () => {
  it("a non-manager is refused", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await get()).status).toBe(403);
  });
  it("only 7, 30 or 90 days", async () => {
    expect((await get("12")).status).toBe(400);
  });
  it("shares out of the period's calls, the latest topic read per call, company-pinned reads", async () => {
    const body = await (await get()).json();
    expect(body).toMatchObject({ days: 30, calls: 4, enough: true });
    expect(body.trackers).toEqual([{ id: "t1", name: "Pricing", active: true, calls: 2, share: 0.5 }]);
    // Events arrive per chunk; the route sorts newest first, so c1's 24 Nov read ("Stale") is the latest one.
    expect(body.topics).toEqual([{ topic: "Stale", calls: 1, share: 0.25 }]);
    for (const t of ["coaching_sessions", "keyword_trackers", "tracker_hits"]) expect(st.eqs).toContainEqual([t, "company_id", "co1"]);
    expect(st.ins).toContainEqual(["coaching_sessions", "context", ["phone", "video"]]);
  });
  it("a failed read of any part is a 500, never a smaller share", async () => {
    for (const t of ["coaching_sessions", "keyword_trackers", "tracker_hits", "events"]) {
      st.fail = t;
      expect((await get()).status, t).toBe(500);
    }
  });
});
