import { describe, it, expect, vi, beforeEach } from "vitest";

/** /brief-templates (F13.2, 0364): managers write and retire; questions are checked; company-pinned. */
const st = vi.hoisted(() => ({ manager: true, inserts: [] as unknown[], eqs: [] as Array<[string, unknown]> }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => (st.manager ? { userId: "u1", companyId: "co1" } : null)) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "is", "order", "update"]) q[m] = () => q;
      q.eq = (k: string, v: unknown) => (st.eqs.push([k, v]), q);
      q.limit = async () => ({ data: [{ id: "t1", name: "Discovery", sections: [{ question: "Budget?", instructions: "" }], created_at: "x" }], error: null });
      q.insert = (row: unknown) => (st.inserts.push(row), { select: () => ({ maybeSingle: async () => ({ data: { id: "t-new" }, error: null }) }) });
      q.then = (r: (v: unknown) => unknown) => r({ data: [{ id: "t1" }], error: null });
      return q;
    },
  }),
}));
import { GET, POST, PATCH } from "../route";
const req = (method: string, body?: unknown) => new Request("http://t/x", { method, ...(body ? { body: JSON.stringify(body) } : {}) }) as never;
beforeEach(() => {
  st.manager = true;
  st.inserts = [];
  st.eqs = [];
});

describe("brief templates", () => {
  it("everyone in the company reads the live templates; managers can manage", async () => {
    const body = await (await GET(req("GET"))).json();
    expect(body).toMatchObject({ available: true, canManage: true, templates: [{ id: "t1", name: "Discovery" }] });
    expect(st.eqs).toContainEqual(["company_id", "co1"]);
  });
  it("managers create with checked questions; reps can't", async () => {
    expect((await POST(req("POST", { name: "Discovery", sections: [] }))).status).toBe(400);
    expect((await POST(req("POST", { name: "Discovery", sections: [{ question: " Budget? " }] }))).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", name: "Discovery", sections: [{ question: "Budget?", instructions: "" }], created_by: "u1" }]);
    st.manager = false;
    expect((await POST(req("POST", { name: "X", sections: [{ question: "q" }] }))).status).toBe(403);
    expect((await PATCH(req("PATCH", { id: "t1", retire: true }))).status).toBe(403);
  });
});
