import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/gamification/leaderboard — 401 unauthenticated; calls the aggregate RPC with a validated period;
 * computes the caller's own rank. The RPC is faked; validation + meRank are the logic under test.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
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
