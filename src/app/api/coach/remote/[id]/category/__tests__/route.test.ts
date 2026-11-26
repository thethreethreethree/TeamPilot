import { describe, it, expect, vi, beforeEach } from "vitest";

/** /[id]/category (F10.10, 0367): only the call's own rep picks, after the call, from a live company category. */
const st = vi.hoisted(() => ({
  user: "rep1",
  session: { id: "11111111-1111-4111-8111-111111111111", companyId: "co1", agentId: "rep1", context: "phone", status: "ended" } as Record<string, unknown> | null,
  category: { id: "22222222-2222-4222-8222-222222222222", retired_at: null } as Record<string, unknown> | null,
  inserts: [] as unknown[],
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: st.user, companyId: "co1" })) }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({ getSession: vi.fn(async () => st.session) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: st.category, error: null });
      q.insert = async (row: unknown) => (st.inserts.push(row), { error: null });
      return q;
    },
  }),
}));
import { POST } from "../route";
const ID = "11111111-1111-4111-8111-111111111111";
const CAT = "22222222-2222-4222-8222-222222222222";
const pick = (categoryId: unknown) => POST(new Request("http://t/x", { method: "POST", body: JSON.stringify({ categoryId }) }) as never, { params: Promise.resolve({ id: ID }) });
beforeEach(() => {
  st.user = "rep1";
  st.session = { id: ID, companyId: "co1", agentId: "rep1", context: "phone", status: "ended" };
  st.category = { id: CAT, retired_at: null };
  st.inserts = [];
});

describe("call category pick", () => {
  it("the call's rep picks a live category; clearing is a pick of null", async () => {
    expect((await pick(CAT)).status).toBe(200);
    expect((await pick(null)).status).toBe(200);
    expect(st.inserts).toEqual([
      { company_id: "co1", session_id: ID, rep_id: "rep1", category_id: CAT, picked_by: "rep1" },
      { company_id: "co1", session_id: ID, rep_id: "rep1", category_id: null, picked_by: "rep1" },
    ]);
  });
  it("someone else, a live call, a door pitch, a retired category or a call you can't open are refused", async () => {
    st.user = "mgr1";
    expect((await pick(CAT)).status).toBe(403);
    st.user = "rep1";
    st.session = { ...(st.session as object), status: "active" };
    expect((await pick(CAT)).status).toBe(400);
    st.session = { ...(st.session as object), status: "ended", context: "in_person" };
    expect((await pick(CAT)).status).toBe(400);
    st.session = { ...(st.session as object), context: "video" };
    st.category = { id: CAT, retired_at: "2026-11-25T00:00:00Z" };
    expect((await pick(CAT)).status).toBe(404);
    st.session = null;
    expect((await pick(CAT)).status).toBe(404);
    expect(st.inserts).toEqual([]);
  });
});
