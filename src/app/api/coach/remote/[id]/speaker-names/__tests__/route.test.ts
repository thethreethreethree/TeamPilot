import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const st = vi.hoisted(() => ({
  who: { userId: "rep1", companyId: "co1" } as unknown,
  manager: null as unknown,
  session: { agentId: "rep1", context: "phone" } as unknown,
  rows: [] as unknown[],
  inserts: [] as unknown[],
  eqs: [] as Array<[string, unknown]>,
}));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => st.who) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => st.manager) }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
const tree = vi.hoisted(() => ({ allows: true }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => tree.allows) }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([c, v]), q);
      q.limit = async () => ({ data: st.rows, error: null });
      return q;
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async (row: unknown) => (st.inserts.push(row), { error: null }) }) }) }));
import { GET, POST } from "../route";

const ctxP = { params: Promise.resolve({ id: "s1" }) };
const post = (b: unknown) => POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }) as never, ctxP);
beforeEach(() => Object.assign(st, { who: { userId: "rep1", companyId: "co1" }, manager: null, session: { agentId: "rep1", context: "phone" }, rows: [], inserts: [], eqs: [] }));

describe("speaker names route (0343)", () => {
  it("GET reads through the caller's own access, company-pinned, latest name per speaker", async () => {
    st.rows = [{ id: 2, speaker: "customer", name: "Dana Lee" }, { id: 1, speaker: "customer", name: "Dana" }];
    expect(await (await GET(new Request("http://x") as never, ctxP)).json()).toEqual({ names: { customer: "Dana Lee" } });
    expect(st.eqs).toContainEqual(["company_id", "co1"]);
  });
  it("the call's rep can name a speaker; the name is cleaned; company and author from the session", async () => {
    expect((await post({ speaker: "customer", name: "  Dana   Lee " })).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", session_id: "s1", speaker: "customer", name: "Dana Lee", set_by: "rep1" }]);
  });
  it("a manager can; a teammate who is neither is refused", async () => {
    st.who = { userId: "m1", companyId: "co1" };
    st.manager = { userId: "m1", companyId: "co1" };
    expect((await post({ speaker: "rep", name: "Alex" })).status).toBe(200);
    st.who = { userId: "peer", companyId: "co1" };
    st.manager = null;
    expect((await post({ speaker: "rep", name: "Alex" })).status).toBe(403);
    expect(st.inserts).toHaveLength(1);
    // A manager outside the rep's reporting tree is refused too.
    st.who = { userId: "m9", companyId: "co1" };
    st.manager = { userId: "m9", companyId: "co1" };
    tree.allows = false;
    expect((await post({ speaker: "rep", name: "Alex" })).status).toBe(403);
    tree.allows = true;
    expect(st.inserts).toHaveLength(1);
  });
  it("a call the caller can't open, or an in-person one, is 404; nothing written", async () => {
    st.session = null;
    expect((await post({ speaker: "rep", name: "Alex" })).status).toBe(404);
    st.session = { agentId: "rep1", context: "in_person" };
    expect((await post({ speaker: "rep", name: "Alex" })).status).toBe(404);
    expect(st.inserts).toEqual([]);
  });
});
