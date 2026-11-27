import { describe, it, expect, vi, beforeEach } from "vitest";

/** /api/coach/remote/deal-views (0371): your own saved board views; a removal is a row, never a delete. */
const st = vi.hoisted(() => ({ rows: [] as unknown[], error: null as { message: string } | null }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({ from: () => ({ insert: async (row: unknown) => (st.rows.push(row), { error: st.error }) }) }),
}));
import { NextRequest } from "next/server";
import { POST } from "../route";
const post = (body: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  st.rows = [];
  st.error = null;
});

describe("saved deal views", () => {
  it("saves your filters under a name", async () => {
    expect((await post({ name: "At risk this month", filters: { risk: "at_risk", close: "this_month" } })).status).toBe(200);
    expect(st.rows).toEqual([{ company_id: "co1", user_id: "u1", name: "At risk this month", filters: { risk: "at_risk", close: "this_month" }, removed: false }]);
  });
  it("removing is a new row", async () => {
    await post({ name: "Old", removed: true });
    expect(st.rows).toEqual([{ company_id: "co1", user_id: "u1", name: "Old", filters: {}, removed: true }]);
  });
  it("an unknown filter is refused before the database", async () => {
    expect((await post({ name: "X", filters: { owner: "someone" } })).status).toBe(400);
    expect(st.rows).toEqual([]);
  });
  it("a failed save is a 500", async () => {
    st.error = { message: "boom" };
    expect((await post({ name: "X", filters: {} })).status).toBe(500);
  });
  it("the search text isn't kept with a view (0388: a search is usually a name, and would outlive erasure)", async () => {
    await post({ name: "Acme ones", filters: { q: "Betty Smith", risk: "flagged" } });
    expect(st.rows).toEqual([{ company_id: "co1", user_id: "u1", name: "Acme ones", filters: { risk: "flagged" }, removed: false }]);
  });
});

