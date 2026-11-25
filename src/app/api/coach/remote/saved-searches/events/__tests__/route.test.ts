import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u-1", companyId: "co1" })) }));
const st = vi.hoisted(() => ({ found: true, eqs: [] as Array<[string, unknown]>, inserts: [] as unknown[] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.is = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([c, v]), q);
      q.maybeSingle = async () => ({ data: st.found ? { id: "x" } : null, error: null });
      q.insert = async (row: unknown) => (st.inserts.push(row), { error: null });
      return q;
    },
  }),
}));
import { POST } from "../route";

const ID = "11111111-1111-4111-8111-111111111111";
const post = (b: unknown) => POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }) as never);
beforeEach(() => Object.assign(st, { found: true, eqs: [], inserts: [] }));

describe("saved search events (0342)", () => {
  it("records follow / unfollow / seen on the caller's own search, owner and company from the session", async () => {
    for (const kind of ["follow", "unfollow", "seen"]) expect((await post({ id: ID, kind })).status).toBe(200);
    expect(st.inserts).toEqual(["follow", "unfollow", "seen"].map((kind) => ({ company_id: "co1", owner_id: "u-1", search_id: ID, kind })));
    expect(st.eqs).toContainEqual(["owner_id", "u-1"]);
    expect(st.eqs).toContainEqual(["company_id", "co1"]);
  });
  it("someone else's (or a removed) search is 404 and nothing is written; a bad kind is 400", async () => {
    st.found = false;
    expect((await post({ id: ID, kind: "follow" })).status).toBe(404);
    expect((await post({ id: ID, kind: "delete" })).status).toBe(400);
    expect(st.inserts).toEqual([]);
  });
});
