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
      for (const m of ["select", "eq", "in", "gte", "order"]) b[m] = () => b;
      b.range = async (from: number) => (from === 0 ? st.reads[t] : { data: [], error: null });
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
  it("a failed read is a 500", async () => {
    st.reads.events = { data: null, error: { message: "x" } };
    expect((await GET(req())).status).toBe(500);
  });
});
