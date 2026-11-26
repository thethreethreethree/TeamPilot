import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn(async () => ({ userId: "m1", companyId: "co1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const st = vi.hoisted(() => ({ filters: [] as Array<[string, string, unknown]> }));
vi.mock("@/lib/api/callerScopedDb", () => ({
  callerScopedDb: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "range"]) q[m] = () => q;
      for (const m of ["eq", "gte", "in"]) q[m] = (k: string, v: unknown) => (st.filters.push([m, k, v]), q);
      q.then = (res: (v: unknown) => unknown) =>
        res({
          data: table === "profiles" ? [{ id: "r1", full_name: "Ana" }] : [{ session_id: "s1", rep_id: "r1", transcript_version: 1, talk_ratio_time: 0.4, longest_rep_monologue_ms: 1000, longest_customer_story_ms: 0, interactivity: 5, patience_ms: 900, rep_questions_per_hour: 12 }],
          error: null,
        });
      return q;
    },
  }),
}));
// ?team= (F10.9 / F16.6): the scope's own rules are tested in teamScope.test.ts; here, what the route does with them.
const scope = vi.hoisted(() => ({ result: { ok: true, members: null } as { ok: true; members: Set<string> | null } | { ok: false; status: number; error: string } }));
vi.mock("@/lib/coach/remote/teamScope", () => ({ teamFromRequest: vi.fn(async () => scope.result) }));
vi.mock("@/lib/api/treeAccess", () => ({ treeAllowsRep: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
const cat = vi.hoisted(() => ({ map: new Map<string, string | null>() as Map<string, string | null> | null }));
vi.mock("@/lib/coach/remote/callCategoriesRead", () => ({ categoriesOf: vi.fn(async () => cat.map) }));
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

const get = (q = "") => GET(new Request(`http://x/api/coach/remote/team-stats${q}`) as never);
beforeEach(() => {
  st.filters = [];
  scope.result = { ok: true, members: null };
});

describe("GET team-stats", () => {
  it("averages per rep over the period's phone/video calls, scoped to the company", async () => {
    const j = await (await get("?days=7")).json();
    expect(j.reps).toEqual([expect.objectContaining({ name: "Ana", calls: 1, talkRatioTime: 0.4 })]);
    expect(st.filters).toContainEqual(["eq", "company_id", "co1"]);
    expect(st.filters).toContainEqual(["in", "coaching_sessions.context", ["phone", "video"]]);
    expect(st.filters.some(([m, k]) => m === "gte" && k === "coaching_sessions.started_at")).toBe(true);
  });
  it("only 7, 30 or 90 days", async () => {
    expect((await get("?days=12")).status).toBe(400);
  });
  it("managers only", async () => {
    vi.mocked(requireSalesCoachManager).mockResolvedValueOnce(null);
    expect((await get()).status).toBe(403);
  });
  it("a chosen team keeps only its people; a refused team is passed through (F10.9 / F16.6)", async () => {
    scope.result = { ok: true, members: new Set(["someone-else"]) };
    expect((await (await get("?days=30&team=x")).json()).reps).toEqual([]);
    scope.result = { ok: true, members: new Set(["r1"]) };
    expect((await (await get("?days=30&team=x")).json()).reps).toHaveLength(1);
    scope.result = { ok: false, status: 404, error: "Team not found." };
    expect((await get("?days=30&team=x")).status).toBe(404);
  });
  it("?category= (F10.9, 0367) keeps only calls whose current category is it; a failed category read is a 500", async () => {
    const C = "11111111-1111-4111-8111-111111111111";
    cat.map = new Map([["s1", "22222222-2222-4222-8222-222222222222"]]);
    expect((await (await get(`?days=7&category=${C}`)).json()).reps).toEqual([]);
    cat.map = new Map([["s1", C]]);
    expect((await (await get(`?days=7&category=${C}`)).json()).reps).toHaveLength(1);
    cat.map = null;
    expect((await get(`?days=7&category=${C}`)).status).toBe(500);
    expect((await get("?days=7&category=nope")).status).toBe(400);
  });
});
