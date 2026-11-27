import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** The usage report (E7): admins only, pinned to the admin's company, and honest when the week had more rows than it reads. */
const st = vi.hoisted(() => ({ ctx: null as Record<string, unknown> | null, eqs: [] as Array<[string, unknown]>, pageRows: 0, pages: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => st.ctx) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "gte", "order"]) q[m] = () => q;
      q.eq = (c: string, v: unknown) => (st.eqs.push([c, v]), q);
      q.range = async () => (st.pages++, { data: Array.from({ length: st.pageRows }, () => ({ key_id: "k", route: "/api/v1/deals", status: 200 })), error: null });
      return q;
    },
  }),
}));
import { GET } from "../route";

const req = () => new NextRequest("http://x/api/coach/remote/settings/api-keys/usage");
beforeEach(() => {
  st.ctx = { userId: "u", companyId: "co1", isAdmin: true };
  st.eqs = [];
  st.pageRows = 3;
  st.pages = 0;
});

describe("GET api-keys/usage", () => {
  it("not signed in → 401; not an admin → 403", async () => {
    st.ctx = null;
    expect((await GET(req())).status).toBe(401);
    st.ctx = { userId: "u", companyId: "co1", isAdmin: false };
    expect((await GET(req())).status).toBe(403);
  });
  it("an admin gets the week's lines, read only from their company", async () => {
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(st.eqs).toContainEqual(["company_id", "co1"]);
    const j = await r.json();
    expect(j).toEqual({ days: 7, lines: [{ keyId: "k", route: "/api/v1/deals", requests: 3, errors: 0, limited: 0 }], partial: false });
  });
  it("past the row cap it stops and says the counts are partial", async () => {
    st.pageRows = 1000;
    const j = await (await GET(req())).json();
    expect(st.pages).toBe(50);
    expect(j.partial).toBe(true);
    expect(j.lines[0].requests).toBe(50_000);
  });
});
