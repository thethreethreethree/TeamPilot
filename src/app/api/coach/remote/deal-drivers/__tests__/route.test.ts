import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** Drivers from the nightly record: only 30 or 90 days; an empty day is "not recorded", never "no warnings"; one rep's filter. */
const st = vi.hoisted(() => ({ rows: [] as unknown[], eqs: [] as unknown[] }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "u1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order"]) q[m] = () => q;
      q.eq = (...a: unknown[]) => (st.eqs.push(a), q);
      q.range = (f: number) => Promise.resolve({ data: f > 0 ? [] : st.rows, error: null });
      return q;
    },
  }),
}));
import { GET } from "../route";
const get = (qs: string) => GET(new NextRequest(`http://x/api?${qs}`));
beforeEach(() => {
  st.rows = [];
  st.eqs = [];
});

describe("deal-drivers", () => {
  it("only 30 or 90 days", async () => {
    expect((await get("daysAgo=7")).status).toBe(400);
  });
  it("an empty day says nothing was recorded", async () => {
    expect(await (await get("daysAgo=30&repId=team")).json()).toMatchObject({ recorded: false, rows: [] });
  });
  it("a recorded day returns its rows; the caller's own deals by default", async () => {
    st.rows = [{ id: 1, rep_id: "u1", reasons: ["ghosted"] }];
    const j = await (await get("daysAgo=90")).json();
    expect(j).toMatchObject({ recorded: true, rows: [{ rep_id: "u1", reasons: ["ghosted"] }] });
    expect(st.eqs).toContainEqual(["rep_id", "u1"]);
  });
});
