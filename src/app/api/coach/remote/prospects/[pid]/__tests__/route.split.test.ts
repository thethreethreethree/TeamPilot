import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/coach/remote/prospects/:pid { action: "split" } (0394; F20.12). Pinned: the shares are stored as the
 * database checks them, through the caller's client; its refusal comes back in its own words (400); a person the
 * policy refuses gets 403; a GET says when the split couldn't be read rather than "no split".
 */
const st = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; row: unknown }>, insertError: null as { code: string; message: string } | null, splitRead: { data: [] as unknown[], error: null as { message: string } | null } }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "rep-1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "neq", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: table === "remote_prospects" ? { id: "d1", rep_id: "rep-1", company_id: "co1" } : null, error: null });
      q.then = (res: (v: unknown) => unknown) => res(table === "deal_splits_current" ? st.splitRead : { data: [], error: null });
      q.insert = async (row: unknown) => (st.inserts.push({ table, row }), { error: st.insertError });
      return q;
    },
  }),
}));
import { POST } from "../route";

const PID = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const post = (b: unknown) => POST(new Request(`http://x/api/coach/remote/prospects/${PID}`, { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }) as never, { params: Promise.resolve({ pid: PID }) });
beforeEach(() => {
  st.inserts = [];
  st.insertError = null;
});

describe("deal split action", () => {
  it("stores the shares as {user_id, pct} through the caller's client", async () => {
    expect((await post({ action: "split", shares: [{ userId: A, pct: 60 }, { userId: B, pct: 40 }] })).status).toBe(200);
    expect(st.inserts).toEqual([{ table: "deal_splits", row: expect.objectContaining({ company_id: "co1", prospect_id: PID, set_by: "rep-1", shares: [{ user_id: A, pct: 60 }, { user_id: B, pct: 40 }] }) }]);
  });
  it("the database's refusal in its own words (400); a refused person 403; bad shapes 400", async () => {
    st.insertError = { code: "23514", message: "deal split: shares must add up to 100" };
    const r = await post({ action: "split", shares: [{ userId: A, pct: 50 }] });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe("Shares must add up to 100.");
    st.insertError = { code: "42501", message: "rls" };
    expect((await post({ action: "split", shares: [{ userId: A, pct: 100 }] })).status).toBe(403);
    st.insertError = null;
    expect((await post({ action: "split", shares: [{ userId: A, pct: 0 }] })).status).toBe(400);
    expect((await post({ action: "split", shares: Array.from({ length: 6 }, () => ({ userId: A, pct: 10 })) })).status).toBe(400);
  });
});
