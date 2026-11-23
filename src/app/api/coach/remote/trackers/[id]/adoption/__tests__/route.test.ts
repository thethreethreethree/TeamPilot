import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "m", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m", companyId: "co1" })) }));
const adm = vi.hoisted(() => ({ inserted: [] as unknown[], tracker: { data: { id: "x" }, error: null } as { data: unknown; error: unknown } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.maybeSingle = async () => adm.tracker;
      b.insert = async (row: unknown) => (adm.inserted.push(row), { error: null });
      return b;
    },
  }),
}));
type Res = { data: unknown; error: unknown };
const ID = "11111111-1111-4111-8111-111111111111";
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res> }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "gte", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => st.reads[t];
      b.range = async (from: number) => (from === 0 ? st.reads[t] : { data: [], error: null });
      b.then = (r: (v: unknown) => unknown) => r(st.reads[t] ?? { data: [], error: null });
      return b;
    },
  }),
}));

import { GET, PUT } from "../route";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
const P = { params: Promise.resolve({ id: ID }) };
const req = (q = "") => ({ nextUrl: new URL(`http://x/api${q}`) }) as never;
const recent = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

beforeEach(() => {
  st.reads = {
    keyword_trackers: { data: { id: ID, name: "New bundle", created_at: recent(20) }, error: null },
    coaching_sessions: { data: [{ id: "s1", agent_id: "r1", started_at: recent(10) }, { id: "s2", agent_id: "r1", started_at: recent(5) }, { id: "s3", agent_id: "r2", started_at: recent(2) }], error: null },
    session_interaction_stats: { data: [{ session_id: "s1", transcript_version: 1 }, { session_id: "s2", transcript_version: 1 }], error: null }, // s3 not analysed yet
    tracker_hits: { data: [{ tracker_id: ID, session_id: "s1", transcript_version: 1, id: 1 }], error: null },
    profiles: { data: [{ id: "r1", full_name: "Rob" }], error: null },
    tracker_goals: { data: [{ id: 3, direction: "at_least", target_pct: 60 }], error: null },
  };
  adm.inserted = [];
  adm.tracker = { data: { id: ID }, error: null };
});

describe("GET tracker adoption", () => {
  it("share of analysed calls since the tracker started; unanalysed calls named, not counted", async () => {
    const j = await (await GET(req(), P)).json();
    expect(j).toMatchObject({ calls: 2, said: 1, rate: 0.5, awaitingAnalysis: 1, reps: [{ name: "Rob", calls: 2, said: 1 }] });
  });
  it("a failed read is a 500, never a lower rate", async () => {
    st.reads.tracker_hits = { data: null, error: { message: "x" } };
    expect((await GET(req(), P)).status).toBe(500);
  });
  it("unknown tracker → 404", async () => {
    st.reads.keyword_trackers = { data: null, error: null };
    expect((await GET(req(), P)).status).toBe(404);
  });
});

describe("tracker goals", () => {
  it("GET shows the goal and whether it's met", async () => {
    expect(await (await GET(req(), P)).json()).toMatchObject({ goal: { direction: "at_least", targetPct: 60 }, goalStatus: "not_met", canSetGoal: true });
  });
  const put = (body: unknown) => new Request("http://x/api", { method: "PUT", body: JSON.stringify(body) }) as never;
  it("a manager sets and clears a goal (appended rows)", async () => {
    expect((await PUT(put({ direction: "at_most", targetPct: 5 }), P)).status).toBe(200);
    expect((await PUT(put({ clear: true }), P)).status).toBe(200);
    expect(adm.inserted).toEqual([
      { company_id: "co1", tracker_id: ID, direction: "at_most", target_pct: 5, set_by: "m" },
      { company_id: "co1", tracker_id: ID, direction: null, target_pct: null, set_by: "m" },
    ]);
  });
  it("refuses a bad goal, another company's tracker, and non-managers", async () => {
    expect((await PUT(put({ direction: "sideways", targetPct: 5 }), P)).status).toBe(400);
    expect((await PUT(put({ direction: "at_least", targetPct: 150 }), P)).status).toBe(400);
    adm.tracker = { data: null, error: null };
    expect((await PUT(put({ direction: "at_least", targetPct: 50 }), P)).status).toBe(404);
    vi.mocked(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await PUT(put({ direction: "at_least", targetPct: 50 }), P)).status).toBe(403);
    expect(adm.inserted).toEqual([]);
  });
});
