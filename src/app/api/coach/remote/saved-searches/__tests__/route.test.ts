import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/remote/saved-searches — a person's own saved searches, through the service role. Pinned (2026-11-23):
 * every read, insert and removal names BOTH the caller's company and the caller as owner (INV29); a removal that touched
 * nothing is "not found"; a query string the search page would refuse is refused here too.
 */
const st = vi.hoisted(() => ({
  filters: [] as Array<[string, string, unknown]>,
  inserts: [] as unknown[],
  updateRows: [{ id: "ss1" }] as unknown[] | null,
  events: [] as unknown[], // 0342 follow/seen rows
  newCalls: { count: 3, capped: false } as { count: number; capped: boolean } | null,
  sinceAsked: [] as string[],
}));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/coach/remote/savedSearchFollow", async (orig) => ({
  ...(await orig<typeof import("@/lib/coach/remote/savedSearchFollow")>()),
  newMatches: vi.fn(async (_db: unknown, _q: string, since: string) => (st.sinceAsked.push(since), st.newCalls)),
}));

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u-1", companyId: "co1" })) }));
vi.mock("@/lib/coach/remote/search", () => ({
  parseCallSearch: (p: URLSearchParams) => (p.get("bad") ? { error: "Unknown filter." } : { filters: {} }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let op = "select";
      const q: Record<string, unknown> = {};
      const rec = (m: string) => (c: string, v: unknown) => (st.filters.push([op, `${m}:${c}`, v]), q);
      q.select = () => q;
      q.eq = rec("eq");
      q.is = rec("is");
      q.order = () => q;
      q.in = () => q;
      q.range = async (from: number) => ({ data: from > 0 ? [] : st.events, error: null });
      q.limit = async () =>
        table === "saved_search_events"
          ? { data: st.events, error: null }
          : { data: [{ id: "ss1", name: "Price objections", filters: { query: "q=price" } }], error: null };
      q.insert = (row: unknown) => {
        st.inserts.push(row);
        return { select: () => ({ maybeSingle: async () => ({ data: { id: "ss-new" }, error: null }) }) };
      };
      q.update = () => ((op = "update"), q);
      q.then = (r: (v: unknown) => unknown) => r({ data: st.updateRows, error: null });
      return q;
    },
  }),
}));

import { GET, POST, PATCH } from "../route";

const req = (method: string, body?: unknown) => new Request("http://x", { method, ...(body ? { body: JSON.stringify(body) } : {}) }) as never;
const scoped = (op: string) => {
  const f = st.filters.filter(([o]) => o === op);
  return { company: f.some(([, k, v]) => k === "eq:company_id" && v === "co1"), owner: f.some(([, k, v]) => k === "eq:owner_id" && v === "u-1") };
};

beforeEach(() => {
  st.filters = [];
  st.inserts = [];
  st.updateRows = [{ id: "ss1" }];
  st.events = [];
  st.newCalls = { count: 3, capped: false };
  st.sinceAsked = [];
});

describe("saved searches", () => {
  it("reads only the caller's own, in their company", async () => {
    const body = await (await GET(req("GET"))).json();
    expect(body.searches).toEqual([{ id: "ss1", name: "Price objections", query: "q=price", following: false, newCount: 0, newCapped: false }]);
    expect(scoped("select")).toEqual({ company: true, owner: true });
  });

  it("saves under the caller and their company", async () => {
    expect((await POST(req("POST", { name: "Price", query: "?q=price" }))).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", owner_id: "u-1", name: "Price", filters: { query: "q=price" } }]);
  });

  it("refuses a nameless search and a query the search page would refuse", async () => {
    expect((await POST(req("POST", { name: "", query: "q=x" }))).status).toBe(400);
    expect((await POST(req("POST", { name: "x", query: "bad=1" }))).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });

  it("removes only the caller's own (company + owner on the update)", async () => {
    expect((await PATCH(req("PATCH", { id: "ss1" }))).status).toBe(200);
    expect(scoped("update")).toEqual({ company: true, owner: true });
  });

  it("a removal that touched nothing — not theirs, or already removed — is 'not found'", async () => {
    st.updateRows = [];
    expect((await PATCH(req("PATCH", { id: "someone-elses" }))).status).toBe(404);
  });
  it("a followed search counts calls since the later of the follow and the last open (0342)", async () => {
    st.events = [
      { search_id: "ss1", kind: "seen", created_at: "2026-11-25T12:00:00Z" },
      { search_id: "ss1", kind: "follow", created_at: "2026-11-20T09:00:00Z" },
    ];
    const body = await (await GET(req("GET"))).json();
    expect(body.searches[0]).toMatchObject({ following: true, newCount: 3, newCapped: false });
    expect(st.sinceAsked).toEqual(["2026-11-25T12:00:00Z"]);
    expect(st.filters.filter(([, k]) => k === "eq:owner_id").length).toBeGreaterThanOrEqual(2); // both reads owner-pinned
  });
  it("an unfollowed search runs no search; a failed run is null, never 0 (0342)", async () => {
    st.events = [
      { search_id: "ss1", kind: "unfollow", created_at: "2026-11-25T12:00:00Z" },
      { search_id: "ss1", kind: "follow", created_at: "2026-11-20T09:00:00Z" },
    ];
    expect((await (await GET(req("GET"))).json()).searches[0]).toMatchObject({ following: false, newCount: 0 });
    expect(st.sinceAsked).toEqual([]);
    st.events = [{ search_id: "ss1", kind: "follow", created_at: "2026-11-20T09:00:00Z" }];
    st.newCalls = null;
    expect((await (await GET(req("GET"))).json()).searches[0]).toMatchObject({ following: true, newCount: null });
  });
});
