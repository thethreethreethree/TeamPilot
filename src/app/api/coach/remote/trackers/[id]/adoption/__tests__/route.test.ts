import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "m", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => null }));
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

import { GET } from "../route";
const P = { params: Promise.resolve({ id: ID }) };
const req = (q = "") => ({ nextUrl: new URL(`http://x/api${q}`) }) as never;
const recent = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

beforeEach(() => {
  st.reads = {
    keyword_trackers: { data: { id: ID, name: "New bundle", created_at: recent(20) }, error: null },
    coaching_sessions: { data: [{ id: "s1", agent_id: "r1", started_at: recent(10) }, { id: "s2", agent_id: "r1", started_at: recent(5) }, { id: "s3", agent_id: "r2", started_at: recent(2) }], error: null },
    session_interaction_stats: { data: [{ session_id: "s1", transcript_version: 1 }, { session_id: "s2", transcript_version: 1 }], error: null }, // s3 not analysed yet
    tracker_hits: { data: [{ session_id: "s1", transcript_version: 1, id: 1 }], error: null },
    profiles: { data: [{ id: "r1", full_name: "Rob" }], error: null },
  };
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
