import { describe, it, expect, vi, beforeEach } from "vitest";

/** /call-categories (F10.10, 0367): company admins add and retire; everyone reads; duplicates refused. */
const st = vi.hoisted(() => ({ admin: true, rows: [{ id: "c1", name: "Demo" }] as unknown[], inserts: [] as unknown[] }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1", isAdmin: st.admin })) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "order", "update"]) q[m] = () => q;
      q.limit = async () => ({ data: st.rows, error: null });
      q.insert = (row: unknown) => (st.inserts.push(row), { select: () => ({ maybeSingle: async () => ({ data: { id: "c-new" }, error: null }) }) });
      q.then = (r: (v: unknown) => unknown) => r({ data: [{ id: "c1" }], error: null });
      return q;
    },
  }),
}));
import { GET, POST, PATCH } from "../route";
const req = (method: string, body?: unknown) => new Request("http://t/x", { method, ...(body ? { body: JSON.stringify(body) } : {}) }) as never;
beforeEach(() => {
  st.admin = true;
  st.rows = [{ id: "c1", name: "Demo" }];
  st.inserts = [];
});

describe("call categories route", () => {
  it("everyone reads; admins add (no duplicates in any case) and retire; others can't", async () => {
    expect(await (await GET(req("GET"))).json()).toMatchObject({ available: true, canManage: true, categories: [{ id: "c1", name: "Demo" }] });
    expect((await POST(req("POST", { name: "demo" }))).status).toBe(400);
    expect((await POST(req("POST", { name: "Renewal" }))).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", name: "Renewal", created_by: "u1" }]);
    expect((await PATCH(req("PATCH", { id: "11111111-1111-4111-8111-111111111111", retire: true }))).status).toBe(200);
    st.admin = false;
    expect((await POST(req("POST", { name: "X" }))).status).toBe(403);
    expect((await PATCH(req("PATCH", { id: "11111111-1111-4111-8111-111111111111", retire: true }))).status).toBe(403);
  });
});
