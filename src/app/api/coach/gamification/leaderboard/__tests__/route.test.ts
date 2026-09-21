import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/gamification/leaderboard — 401 unauthenticated; calls the aggregate RPC with a validated period;
 * computes the caller's own rank. The RPC is faked; validation + meRank are the logic under test.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
// The ranking gate added 2026-09-22 (founder ruling: the KPI document wins on anything a rep
// sees). These cases are about the BOARD, so the caller is a manager throughout; the
// non-manager path has its own describe block.
vi.mock("@/lib/api/requireSalesCoachManager", () => ({ requireSalesCoachManager: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { GET } from "../route";

const setAuth = (v: unknown) => (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);
let lastPeriod: string | undefined;
const setRpc = (rows: unknown[]) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    rpc: async (_fn: string, args: { p_period: string }) => {
      lastPeriod = args.p_period;
      return { data: rows, error: null };
    },
  });

const req = (period?: string) => new Request(`http://localhost/api/coach/gamification/leaderboard${period ? `?period=${period}` : ""}`) as never;

beforeEach(() => {
  vi.clearAllMocks();
  (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    userId: "mgr", companyId: "co1",
  });
  lastPeriod = undefined;
});

describe("GET leaderboard", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setRpc([]);
    expect((await GET(req())).status).toBe(401);
  });

  it("returns the board and the caller's rank; passes a valid period through", async () => {
    setAuth({ userId: "u2", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "u1", full_name: "Top", sessions: 10, total_points: 900, avg_points: 90, best_points: 100, deals: 5 },
      { agent_id: "u2", full_name: "Me", sessions: 8, total_points: 600, avg_points: 75, best_points: 88, deals: 2 },
    ]);
    const res = await GET(req("month"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(lastPeriod).toBe("month");
    expect(body.rows).toHaveLength(2);
    expect(body.meId).toBe("u2");
    expect(body.meRank).toBe(2); // u2 is the second row
  });

  it("an invalid period falls back to 'all'", async () => {
    setAuth({ userId: "u1", companyId: "c1", isAdmin: false });
    setRpc([]);
    await GET(req("year"));
    expect(lastPeriod).toBe("all");
  });

  it("meRank is null when the caller has no points yet", async () => {
    setAuth({ userId: "nobody", companyId: "c1", isAdmin: false });
    setRpc([{ agent_id: "u1", full_name: "A", sessions: 1, total_points: 50, avg_points: 50, best_points: 50, deals: 0 }]);
    const body = await (await GET(req())).json();
    expect(body.meRank).toBeNull();
  });

  it("a rep TIED on points shares the higher rank, not second place", async () => {
    // Founder decision, 4 September 2026. This used to be `meIndex + 1`, so the
    // second of two identical reps was told they came second — which is false,
    // and is the kind of thing a person remembers being told. The mobile app
    // applies the same rule so the two surfaces never disagree.
    setAuth({ userId: "u2", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "u1", full_name: "Ana", sessions: 8, total_points: 600, avg_points: 75, best_points: 88, deals: 2 },
      { agent_id: "u2", full_name: "Me", sessions: 6, total_points: 600, avg_points: 100, best_points: 100, deals: 2 },
      { agent_id: "u3", full_name: "Ben", sessions: 4, total_points: 300, avg_points: 75, best_points: 80, deals: 1 },
    ]);
    const body = await (await GET(req())).json();
    expect(body.meRank).toBe(1);
  });

  it("the place a tie consumed is skipped, so third really is third", async () => {
    // 1, 2, 2, 4 — not 1, 2, 2, 3. Without the skip a rep would appear to be
    // beating more people than they are.
    setAuth({ userId: "u4", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "u1", full_name: "A", sessions: 1, total_points: 900, avg_points: 90, best_points: 90, deals: 0 },
      { agent_id: "u2", full_name: "B", sessions: 1, total_points: 600, avg_points: 60, best_points: 60, deals: 0 },
      { agent_id: "u3", full_name: "C", sessions: 1, total_points: 600, avg_points: 60, best_points: 60, deals: 0 },
      { agent_id: "u4", full_name: "Me", sessions: 1, total_points: 100, avg_points: 10, best_points: 10, deals: 0 },
    ]);
    const body = await (await GET(req())).json();
    expect(body.meRank).toBe(4);
  });

  it("a bigint total arriving as a STRING still ties", async () => {
    // total_points is a bigint in the 0243 aggregate and PostgREST serialises
    // it as a string. Comparing raw values would make "600" and 600 look like
    // different totals and silently break the tie — the bug hidden by a type.
    setAuth({ userId: "u2", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "u1", full_name: "Ana", sessions: 8, total_points: "600", avg_points: 75, best_points: 88, deals: 2 },
      { agent_id: "u2", full_name: "Me", sessions: 6, total_points: 600, avg_points: 100, best_points: 100, deals: 2 },
    ]);
    const body = await (await GET(req())).json();
    expect(body.meRank).toBe(1);
  });
});

describe("a rep is not shown a cross-agent ranking", () => {
  /**
   * Founder ruling, 2026-09-22: where the rubric sheet and SalesCoach-KPI-System.md conflict on
   * anything a REP sees, the KPI document wins. Its clause, marked non-negotiable:
   *
   *   "Cross-agent ranking exists for managers only, is never the default view, and is never how
   *    results are framed to the agent."
   *
   * This route had served the full ranked board, with names, to every company member since it was
   * built. It was found by sweeping rep-facing surfaces against the document AFTER the ruling —
   * applying the ruling only where I had already made a call would have left it in place.
   */
  const asRep = () =>
    (requireSalesCoachManager as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

  it("sends no rows and no rank", async () => {
    setAuth({ userId: "rep1", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "other", full_name: "Someone Else", sessions: 9, total_points: 900, avg_points: 100, best_points: 120, deals: 4 },
      { agent_id: "rep1", full_name: "Me", sessions: 2, total_points: 100, avg_points: 50, best_points: 60, deals: 0 },
    ]);
    asRep();

    const body = await (await GET(req())).json();
    expect(body.managerView).toBe(false);
    expect(body.rows).toBeUndefined();
    expect(body.meRank).toBeUndefined();
  });

  it("leaks no other rep's name or total, even though the RPC returned them", async () => {
    // The stronger assertion: the aggregate RAN and its rows were discarded. A filtered board
    // would still be a board, and a rank is a rank however few people are on it.
    setAuth({ userId: "rep1", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "other", full_name: "Someone Else", sessions: 9, total_points: 900, avg_points: 100, best_points: 120, deals: 4 },
    ]);
    asRep();

    const wire = JSON.stringify(await (await GET(req())).json());
    expect(wire).not.toContain("Someone Else");
    expect(wire).not.toContain("900");
    expect(wire).not.toMatch(/"rank"|"meRank"/);
  });

  it("still tells the caller who they are, so the page can render something", async () => {
    setAuth({ userId: "rep1", companyId: "c1", isAdmin: false });
    setRpc([]);
    asRep();
    expect((await (await GET(req())).json()).meId).toBe("rep1");
  });

  it("gives a manager the board, unchanged", async () => {
    setAuth({ userId: "mgr", companyId: "c1", isAdmin: false });
    setRpc([
      { agent_id: "mgr", full_name: "Boss", sessions: 3, total_points: 300, avg_points: 100, best_points: 110, deals: 1 },
    ]);
    const body = await (await GET(req())).json();
    expect(body.managerView).toBe(true);
    expect(body.rows).toHaveLength(1);
    expect(body.meRank).toBe(1);
  });
});
