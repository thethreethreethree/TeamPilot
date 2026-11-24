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
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

const get = (q = "") => GET(new Request(`http://x/api/coach/remote/team-stats${q}`) as never);
beforeEach(() => {
  st.filters = [];
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
});
