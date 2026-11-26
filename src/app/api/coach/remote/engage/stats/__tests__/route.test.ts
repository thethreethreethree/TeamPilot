import { describe, it, expect, vi } from "vitest";

/** /api/coach/remote/engage/stats (plan E2): per-flow and per-rep counts from what the caller can see; a failed read is a 500. */
const st = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn(async () => ({ userId: "a", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const data: Record<string, unknown[]> = {
  engage_enrolments: [{ id: "e1", flow_id: "f1", rep_id: "a" }],
  engage_activities: [{ id: 1, enrolment_id: "e1", step_index: 0, action: "complete_step", outcome: "follow_up" }],
  engage_flows: [{ id: "f1", name: "After the call", steps: [{ kind: "call" }] }],
};
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "gte", "in"]) q[m] = () => q;
      q.range = async (from: number) => (st.fail ? { data: null, error: { message: "boom" } } : { data: from > 0 ? [] : data[t], error: null });
      q.then = (r: (v: unknown) => unknown) => r({ data: data[t], error: null });
      return q;
    },
  }),
}));
import { NextRequest } from "next/server";
import { GET } from "../route";

describe("engage stats", () => {
  it("rolls up per flow, with names and connect rate", async () => {
    const j = await (await GET(new NextRequest("http://x/api?days=30"))).json();
    expect(j.byFlow[0]).toMatchObject({ name: "After the call", people: 1, calls: 1, stepsDone: 1, connectRate: 1 });
    expect(j.byRep[0]).toMatchObject({ key: "a", calls: 1 });
  });
  it("a failed read is a 500", async () => {
    st.fail = true;
    expect((await GET(new NextRequest("http://x/api"))).status).toBe(500);
    st.fail = false;
  });
});
