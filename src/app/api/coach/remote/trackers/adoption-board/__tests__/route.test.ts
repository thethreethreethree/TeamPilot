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

import { GET } from "../route";
const req = () => ({ nextUrl: new URL("http://x/api") }) as never;
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

beforeEach(() => {
  st.reads = {
    keyword_trackers: { data: [{ id: "t-old", name: "Bundle", created_at: ago(60) }, { id: "t-new", name: "Decision date", created_at: ago(3) }], error: null },
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
