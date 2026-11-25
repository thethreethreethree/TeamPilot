import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
const who = vi.hoisted(() => ({ ctx: { userId: "mgr", companyId: "co1", isAdmin: false } as unknown }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => who.ctx) }));
const st = vi.hoisted(() => ({ hides: [] as unknown[], unhides: [] as unknown[], inserts: [] as Array<{ t: string; row: unknown }>, audits: [] as unknown[] }));
// The verdict is the SQL rule's; here it is "hidden unless the rep (rep1) or the admin (adm)".
vi.mock("@/lib/coach/remote/hidePhrases", () => ({ hiddenFrom: vi.fn(async (_a: unknown, ids: string[], viewer: string) => new Set(viewer === "rep1" || viewer === "adm" ? [] : ids)) }));
vi.mock("@/lib/audit/recordAudit", () => ({ recordAudit: vi.fn(async (_a: unknown, e: unknown) => (st.audits.push(e), true)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: { agent_id: "rep1" }, error: null });
      q.then = (res: (v: unknown) => unknown) => res({ data: t === "call_hides" ? st.hides : st.unhides, error: null });
      q.insert = async (row: unknown) => (st.inserts.push({ t, row }), { error: null });
      return q;
    },
  }),
}));
import { GET, POST } from "../route";

const H1 = "11111111-1111-4111-8111-111111111111";
const get = async () => (await (GET(new Request("http://x") as never, { params: Promise.resolve({ id: "s1" }) }) as Promise<Response>)).json();
const post = (body: unknown) => POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "s1" }) }) as Promise<Response>;
beforeEach(() => {
  who.ctx = { userId: "mgr", companyId: "co1", isAdmin: false };
  Object.assign(st, { hides: [{ id: H1, phrase: "personal call" }], unhides: [], inserts: [], audits: [] });
});

describe("call hidden notice (0337)", () => {
  it("not hidden → hidden:false", async () => {
    st.hides = [];
    expect(await get()).toEqual({ hidden: false, phrases: [], canSee: true, hides: [] });
  });
  it("a manager it's hidden from reads why, can't see it, and gets no unhide handles", async () => {
    expect(await get()).toEqual({ hidden: true, phrases: ["personal call"], canSee: false, hides: [] });
  });
  it("the call's rep can see it; an admin also gets the unhide handles", async () => {
    who.ctx = { userId: "rep1", companyId: "co1", isAdmin: false };
    expect(await get()).toMatchObject({ canSee: true, hides: [] });
    who.ctx = { userId: "adm", companyId: "co1", isAdmin: true };
    expect(await get()).toMatchObject({ canSee: true, hides: [{ id: H1, phrase: "personal call" }] });
  });
  it("an unhidden hide no longer counts", async () => {
    st.unhides = [{ hide_id: H1 }];
    expect(await get()).toMatchObject({ hidden: false });
  });
  it("unhide: admins only, an active hide only, audited", async () => {
    expect((await post({ hideId: H1 })).status).toBe(403);
    who.ctx = { userId: "adm", companyId: "co1", isAdmin: true };
    expect((await post({ hideId: "22222222-2222-4222-8222-222222222222" })).status).toBe(404);
    expect((await post({ hideId: H1 })).status).toBe(200);
    expect(st.inserts).toEqual([{ t: "call_unhides", row: { hide_id: H1, company_id: "co1", unhidden_by: "adm" } }]);
    expect(st.audits).toEqual([expect.objectContaining({ action: "call.unhide" })]);
  });
});
