import { describe, it, expect, vi, beforeEach } from "vitest";

/** Rubric-item tags on scenarios (0326): managers only; only real rubric items; company-pinned writes. */
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
const st = vi.hoisted(() => ({ inserts: [] as unknown[], scen: { id: "s1", retired_at: null } as Record<string, unknown> | null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: st.scen, error: null });
      b.then = (r: (v: unknown) => unknown) => r({ data: [{ scenario_id: "s1", element_id: "x" }], error: null });
      b.insert = async (row: unknown) => (st.inserts.push(row), { error: null });
      return b;
    },
  }),
}));
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { REMOTE_RUBRIC } from "@/lib/coach/pitchScore/rubricRegistry";
import { GET, PUT } from "../route";

const put = (body: unknown) => new Request("http://x", { method: "PUT", body: JSON.stringify(body) }) as never;
const REAL = REMOTE_RUBRIC.elements[0]!.id;
beforeEach(() => {
  st.inserts = [];
  st.scen = { id: "s1", retired_at: null };
});

describe("scenario rubric tags", () => {
  it("GET lists the rubric items and the tags; managers only", async () => {
    const j = await (await GET(new Request("http://x") as never)).json();
    expect(j.items.length).toBe(REMOTE_RUBRIC.elements.length);
    expect(j.tags).toEqual([{ scenarioId: "s1", elementId: "x" }]);
    vi.mocked(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://x") as never)).status).toBe(403);
  });
  it("PUT tags a real rubric item, pinned to the company; refuses a made-up one and a retired scenario", async () => {
    expect((await PUT(put({ scenarioId: "s1", elementId: REAL, on: true }))).status).toBe(200);
    expect(st.inserts).toEqual([{ company_id: "co1", scenario_id: "s1", element_id: REAL, is_on: true, set_by: "m1" }]);
    expect((await PUT(put({ scenarioId: "s1", elementId: "made.up", on: true }))).status).toBe(400);
    st.scen = { id: "s1", retired_at: "2026-11-01" };
    expect((await PUT(put({ scenarioId: "s1", elementId: REAL, on: true }))).status).toBe(409);
    expect(st.inserts).toHaveLength(1);
  });
});
