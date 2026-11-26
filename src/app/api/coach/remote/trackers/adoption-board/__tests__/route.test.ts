import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "m", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
type Res = { data: unknown; error: unknown };
const st = vi.hoisted(() => ({ reads: {} as Record<string, Res> }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "gte", "order", "limit"]) b[m] = () => b;
      b.range = async (from: number) => (from === 0 ? st.reads[t] : { data: [], error: null });
      b.then = (r: (v: unknown) => unknown) => r(st.reads[t] ?? { data: [], error: null });
      return b;
    },
  }),
}));

// ?by=team (F18.4): the org chart and the tree check.
const org = vi.hoisted(() => ({ manager: true, visible: null as string[] | null, people: [] as Array<{ id: string; managerId: string | null }> }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => (org.manager ? { userId: "m", companyId: "co1" } : null)) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeFilterRepsChecked: vi.fn(async (_r: unknown, ids: string[]) => (org.visible === null ? ids : org.visible.filter((i) => ids.includes(i)))) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/coach/remote/teamScope", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/teamScope")>()),
  companyPeople: vi.fn(async () => org.people.map((p) => ({ ...p, companyId: "co1", isCompanyAdmin: false, isSalesCoachManager: false }))),
}));

import { GET } from "../route";
const req = (q = "") => ({ nextUrl: new URL(`http://x/api${q}`) }) as never;
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

beforeEach(() => {
  st.reads = {
    keyword_trackers_live: { data: [{ id: "t-old", name: "Bundle", created_at: ago(60) }, { id: "t-new", name: "Decision date", created_at: ago(3) }], error: null },
    coaching_sessions: { data: [{ id: "s1", agent_id: "r", started_at: ago(10) }, { id: "s2", agent_id: "r", started_at: ago(1) }], error: null },
    session_interaction_stats: { data: [{ session_id: "s1", transcript_version: 1 }, { session_id: "s2", transcript_version: 1 }], error: null },
    tracker_hits: { data: [{ tracker_id: "t-old", session_id: "s1", transcript_version: 1, id: 1 }, { tracker_id: "t-new", session_id: "s2", transcript_version: 1, id: 2 }], error: null },
    tracker_goals: { data: [{ id: 5, tracker_id: "t-old", direction: "at_least", target_pct: 40 }], error: null },
  };
});

describe("GET adoption board", () => {
  it("each message counts calls since IT started listening, with its own goal", async () => {
    const j = await (await GET(req())).json();
    const by = Object.fromEntries(j.rows.map((r: { id: string }) => [r.id, r]));
    expect(by["t-old"]).toMatchObject({ calls: 2, said: 1, rate: 0.5, goal: { direction: "at_least", targetPct: 40 }, goalStatus: "met" });
    expect(by["t-new"]).toMatchObject({ calls: 1, said: 1, rate: 1, goal: null, goalStatus: null }); // s1 predates it
  });
  it("a failed read is a 500", async () => {
    st.reads.session_interaction_stats = { data: null, error: { message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
});

describe("GET adoption board ?by=team (F18.4, 2026-11-26)", () => {
  beforeEach(() => {
    org.manager = true;
    org.visible = null;
    // m1 leads r; m2 leads r2 (who has no calls here)
    org.people = [{ id: "m1", managerId: null }, { id: "r", managerId: "m1" }, { id: "m2", managerId: null }, { id: "r2", managerId: "m2" }];
    st.reads.profiles = { data: [{ id: "m1", full_name: "Max" }, { id: "m2", full_name: "Rae" }], error: null };
  });
  it("each message's share of calls per team the caller may see", async () => {
    const j = await (await GET(req("?by=team"))).json();
    expect(j.teams).toEqual([{ id: "m1", name: "Max's team" }, { id: "m2", name: "Rae's team" }]);
    const old = j.rows.find((r: { id: string }) => r.id === "t-old");
    expect(old.byTeam).toEqual([{ teamId: "m1", calls: 2, said: 1, rate: 0.5 }, { teamId: "m2", calls: 0, said: 0, rate: null }]);
  });
  it("only teams whose manager the tree allows; managers only", async () => {
    org.visible = ["m1"];
    const j = await (await GET(req("?by=team"))).json();
    expect(j.teams.map((t: { id: string }) => t.id)).toEqual(["m1"]);
    org.manager = false;
    expect((await GET(req("?by=team"))).status).toBe(403);
  });
});

