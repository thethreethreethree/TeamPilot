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
      b.then = (res: (v: unknown) => unknown) => res(st.reads[t] ?? { data: [], error: null });
      return b;
    },
  }),
}));

import { GET } from "../route";
const req = () => ({ nextUrl: new URL("http://x/api?module=remote_sales") }) as never;

beforeEach(() => {
  st.reads = {
    coaching_sessions: {
      data: [
        { id: "s1", started_at: "2026-11-20T10:00:00Z", outcome: "sold", session_kind: "sales" },
        { id: "m1", started_at: "2026-11-20T11:00:00Z", outcome: null, session_kind: "meeting" },
      ],
      error: null,
    },
    events: {
      data: [
        { subject: "sales_session:s1", payload: { intel: { competitors: ["Acme"], topics: ["Price"] } }, created_at: "2026-11-20T12:00:00Z", id: "e2" },
        { subject: "sales_session:s1", payload: { intel: { competitors: ["Old"], topics: [] } }, created_at: "2026-11-20T10:30:00Z", id: "e1" },
      ],
      error: null,
    },
  };
});

describe("GET market", () => {
  it("sales calls only, each call's latest intel", async () => {
    const j = await (await GET(req())).json();
    expect(j).toMatchObject({ calls: 1, withIntel: 1, competitors: [{ name: "Acme", calls: 1 }], topics: [{ name: "Price", calls: 1 }] });
  });
  it("counts topics with the company's current groups; a retired group no longer applies", async () => {
    st.reads.events = {
      data: [
        { subject: "sales_session:s1", payload: { intel: { competitors: [], topics: ["monthly price", "Pricing"] } }, created_at: "2026-11-20T12:00:00Z", id: "e2" },
      ],
      error: null,
    };
    st.reads.market_topic_groups = { data: [{ id: "g2", name: "Price", members: ["pricing", "monthly price"], source: "ai_suggested", created_at: "2026-11-22T00:00:00Z" }, { id: "g1", name: "Old", members: ["pricing", "x"], source: "manager", created_at: "2026-11-21T00:00:00Z" }], error: null };
    st.reads.market_topic_group_retirements = { data: [{ group_id: "g1" }], error: null };
    const j = await (await GET(req())).json();
    expect(j.topics).toEqual([{ name: "Price", calls: 1, variants: ["monthly price", "pricing"], groupId: "g2" }]);
  });
  it("a failed topic-group read is a 500, not ungrouped counts", async () => {
    st.reads.market_topic_groups = { data: null, error: { code: "XX000", message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
  it("a failed read is a 500", async () => {
    st.reads.events = { data: null, error: { message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
});
