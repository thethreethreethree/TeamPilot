import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/market/topic-groups (0319). Pins: writes are managers-only; a member must be a topic on 2+ calls
 * not in another group (no one-off label lands in a company table); replace retires the old group; every write is
 * pinned to the manager's company.
 */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
const st = vi.hoisted(() => ({
  groups: [] as Array<{ id: string; name: string; members: string[]; source: string; createdAt: string }>,
  inserts: [] as Array<[string, Record<string, unknown>]>,
  found: true as boolean,
}));
vi.mock("@/lib/coach/remote/marketRead", () => ({
  readMarketInputs: vi.fn(async () => ({
    ok: true,
    calls: ["a", "b", "c"].map((id) => ({ sessionId: id, startedAt: "2026-11-20T10:00:00Z", outcome: null })),
    intel: new Map([
      ["a", { competitors: [], topics: ["pricing", "monthly price", "one-off thing"] }],
      ["b", { competitors: [], topics: ["pricing", "monthly prices"] }],
      ["c", { competitors: [], topics: ["hbo"] }],
    ]),
  })),
  readTopicGroups: vi.fn(async () => ({ ok: true, groups: st.groups })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.insert = (row: Record<string, unknown>) => {
        st.inserts.push([t, row]);
        const r = { data: { id: "new", created_at: "2026-11-23T00:00:00Z" }, error: null };
        return { select: () => ({ maybeSingle: async () => r }), then: (res: (v: unknown) => unknown) => res({ error: null }) };
      };
      b.maybeSingle = async () => ({ data: st.found ? { id: "g1" } : null, error: null });
      return b;
    },
  }),
}));

import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { DELETE, GET, POST } from "../route";

const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;
beforeEach(() => {
  st.groups = [];
  st.inserts = [];
  st.found = true;
});

describe("topic-groups", () => {
  it("GET lists the groups and says whether the caller can manage them", async () => {
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const j = await (await GET(new Request("http://x/api") as never)).json();
    expect(j).toEqual({ canManage: false, groups: [] });
  });
  it("GET ?candidates=1 lists the topics a group may take — the same rule the save check applies", async () => {
    st.groups = [{ id: "g1", name: "TV", members: ["hbo", "pricing"], source: "manager", createdAt: "" }];
    const plain = await (await GET(new Request("http://x/api?candidates=1") as never)).json();
    expect(plain.candidates).toEqual([{ name: "monthly price", calls: 2 }]); // pricing is in g1; one-offs never
    const editing = await (await GET(new Request("http://x/api?candidates=1&editing=g1") as never)).json();
    expect(editing.candidates.map((c: { name: string }) => c.name)).toEqual(["monthly price", "pricing"]);
  });
  it("GET ?candidates=1 gives no list to someone who can't manage", async () => {
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const j = await (await GET(new Request("http://x/api?candidates=1") as never)).json();
    expect(j).toEqual({ canManage: false, groups: [] });
  });
  it("POST is managers only", async () => {
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    expect((await POST(post({ name: "Price", members: ["pricing", "monthly price"] }))).status).toBe(403);
  });
  it("stores a group of topics on 2+ calls, pinned to the company", async () => {
    const r = await POST(post({ module: "remote_sales", name: "Price", members: ["Pricing", "monthly price"], source: "ai_suggested" }));
    expect(r.status).toBe(200);
    expect(st.inserts).toEqual([["market_topic_groups", { company_id: "co1", name: "Price", members: ["pricing", "monthly price"], source: "ai_suggested", created_by: "m1" }]]);
  });
  it("refuses a one-off label (could be one customer's words) and a topic already in another group", async () => {
    expect((await POST(post({ name: "X", members: ["pricing", "one-off thing"] }))).status).toBe(400);
    st.groups = [{ id: "g1", name: "Price", members: ["pricing", "hbo"], source: "manager", createdAt: "" }];
    expect((await POST(post({ name: "X", members: ["pricing", "monthly price"] }))).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });
  it("replace: the old group's members are allowed again and it is retired", async () => {
    st.groups = [{ id: "g1", name: "Price", members: ["pricing", "hbo"], source: "manager", createdAt: "" }];
    const r = await POST(post({ name: "Price", members: ["pricing", "monthly price"], replaces: "g1" }));
    expect(r.status).toBe(200);
    expect(st.inserts.map(([t]) => t)).toEqual(["market_topic_groups", "market_topic_group_retirements"]);
    expect(st.inserts[1]![1]).toEqual({ group_id: "g1", company_id: "co1", retired_by: "m1" });
  });
  it("DELETE retires a group of the company; an unknown one is 404", async () => {
    expect((await DELETE(new Request("http://x/api?id=g1", { method: "DELETE" }) as never)).status).toBe(200);
    expect(st.inserts).toEqual([["market_topic_group_retirements", { group_id: "g1", company_id: "co1", retired_by: "m1" }]]);
    st.found = false;
    expect((await DELETE(new Request("http://x/api?id=zz", { method: "DELETE" }) as never)).status).toBe(404);
  });
});
