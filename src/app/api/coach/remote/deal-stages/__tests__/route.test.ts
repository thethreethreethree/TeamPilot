import { describe, it, expect, vi, beforeEach } from "vitest";

/** /api/coach/remote/deal-stages (0371): the database's policy and check are the gate; the route maps their answers. */
const st = vi.hoisted(() => ({ insertError: null as { code?: string; message: string } | null, rows: [] as unknown[], read: { data: null as unknown, error: null as unknown } }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: () => ({
      select: () => ({ maybeSingle: async () => st.read }),
      insert: async (row: unknown) => (st.rows.push(row), { error: st.insertError }),
    }),
  }),
}));
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
const post = (body: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  st.insertError = null;
  st.rows = [];
  st.read = { data: null, error: null };
});

describe("deal stages", () => {
  it("no list yet reads as null, not an empty list", async () => {
    expect(await (await GET(new NextRequest("http://x/api"))).json()).toMatchObject({ stages: null });
  });
  it("a failed read is a 500", async () => {
    st.read = { data: null, error: { message: "boom" } };
    expect((await GET(new NextRequest("http://x/api"))).status).toBe(500);
  });
  it("saves the whole list, company and actor from the session", async () => {
    const res = await post({ stages: [{ name: " Demo ", kind: "open" }] });
    expect(res.status).toBe(200);
    expect(st.rows).toEqual([{ company_id: "co1", stages: [{ name: "Demo", kind: "open" }], actor_id: "u1" }]);
  });
  it("a rep is refused by the policy (403); a list the check refuses is a 400", async () => {
    st.insertError = { code: "42501", message: "rls" };
    expect((await post({ stages: [{ name: "Demo", kind: "open" }] })).status).toBe(403);
    st.insertError = { code: "23514", message: "check" };
    expect((await post({ stages: [{ name: "Won", kind: "won" }] })).status).toBe(400);
  });
  it("an empty list or an unknown kind never reaches the database", async () => {
    expect((await post({ stages: [] })).status).toBe(400);
    expect((await post({ stages: [{ name: "X", kind: "maybe" }] })).status).toBe(400);
    expect(st.rows).toEqual([]);
  });
});
