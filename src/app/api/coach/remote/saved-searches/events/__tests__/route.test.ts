import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u-1", companyId: "co1" })) }));
const st = vi.hoisted(() => ({ found: true, owner: "u-1", shares: [] as unknown[], manager: false, eqs: [] as Array<[string, unknown]>, inserts: [] as Array<[string, unknown]> }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => (st.manager ? { userId: "u-1", companyId: "co1" } : null)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.is = () => q;
      q.order = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([c, v]), q);
      q.maybeSingle = async () => ({ data: st.found ? { id: "x", owner_id: st.owner } : null, error: null });
      q.range = async (from: number) => ({ data: from > 0 ? [] : st.shares, error: null });
      q.insert = async (row: unknown) => (st.inserts.push([t, row]), { error: null });
      return q;
    },
  }),
}));
import { POST } from "../route";

const ID = "11111111-1111-4111-8111-111111111111";
const post = (b: unknown) => POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }) as never);
beforeEach(() => Object.assign(st, { found: true, owner: "u-1", shares: [], manager: false, eqs: [], inserts: [] }));

describe("saved search events (0342)", () => {
  it("records follow / unfollow / seen on the caller's own search, owner and company from the session", async () => {
    for (const kind of ["follow", "unfollow", "seen"]) expect((await post({ id: ID, kind })).status).toBe(200);
    expect(st.inserts).toEqual(["follow", "unfollow", "seen"].map((kind) => ["saved_search_events", { company_id: "co1", owner_id: "u-1", search_id: ID, kind }]));
    expect(st.eqs).toContainEqual(["company_id", "co1"]);
  });
  it("someone else's (or a removed) search is 404 and nothing is written; a bad kind is 400", async () => {
    st.found = false;
    expect((await post({ id: ID, kind: "follow" })).status).toBe(404);
    expect((await post({ id: ID, kind: "delete" })).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });
  it("0362: someone else's search can be followed only while it's shared; the follow is written under YOUR id", async () => {
    st.owner = "mgr-9";
    expect((await post({ id: ID, kind: "follow" })).status).toBe(404); // not shared
    st.shares = [{ id: 1, search_id: ID, kind: "share" }];
    expect((await post({ id: ID, kind: "follow" })).status).toBe(200);
    expect(st.inserts).toEqual([["saved_search_events", { company_id: "co1", owner_id: "u-1", search_id: ID, kind: "follow" }]]);
    st.shares = [{ id: 1, search_id: ID, kind: "share" }, { id: 2, search_id: ID, kind: "unshare" }];
    expect((await post({ id: ID, kind: "follow" })).status).toBe(404); // unshared since
  });
  it("0362: only the owner, a manager, shares or unshares", async () => {
    expect((await post({ id: ID, kind: "share" })).status).toBe(403); // owner, not a manager
    st.manager = true;
    expect((await post({ id: ID, kind: "share" })).status).toBe(200);
    expect(st.inserts).toEqual([["saved_search_shares", { company_id: "co1", search_id: ID, kind: "share", actor_id: "u-1" }]]);
    st.owner = "someone-else";
    expect((await post({ id: ID, kind: "unshare" })).status).toBe(404);
  });
});
