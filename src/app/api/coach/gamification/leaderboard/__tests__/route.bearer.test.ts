import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * leaderboard — the mobile Bearer path for a SECURITY DEFINER RPC. The board calls gamification_leaderboard(period),
 * whose company scoping comes from auth_company_id() INSIDE the function — which only resolves if the RPC runs on a
 * client carrying the caller's JWT. So a Bearer request must call the RPC through the caller-scoped token client, not
 * the cookie client (stubbed to THROW here). This is a distinct wiring from my-points' plain read, so it earns its
 * own test.
 */
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));
vi.mock("@/lib/api/callerScopedDb", () => ({ callerScopedDb: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    throw new Error("cookie client must NOT be used on a Bearer request");
  }),
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));

import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { GET } from "../route";

const bearerReq = () =>
  new Request("http://localhost/api/coach/gamification/leaderboard?period=month", { headers: { authorization: "Bearer tok" } }) as never;

let lastPeriod: string | undefined;
function scopedClientWithRpc(rows: unknown[]) {
  return {
    rpc: async (_fn: string, args: { p_period: string }) => {
      lastPeriod = args.p_period;
      return { data: rows, error: null };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lastPeriod = undefined;
});

describe("leaderboard — mobile Bearer path (SECURITY DEFINER RPC)", () => {
  it("calls the RPC through the caller-scoped token client and returns the board + the caller's rank", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u2", companyId: "c1", isAdmin: false });
    (callerScopedDb as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      scopedClientWithRpc([
        { agent_id: "u1", full_name: "Top", sessions: 10, total_points: 900, avg_points: 90, best_points: 100, deals: 5 },
        { agent_id: "u2", full_name: "Me", sessions: 8, total_points: 600, avg_points: 75, best_points: 88, deals: 2 },
      ]),
    );
    const res = await GET(bearerReq());
    expect(res.status).toBe(200); // NOT a throw from the cookie client
    const body = await res.json();
    expect(lastPeriod).toBe("month");
    expect(body.rows).toHaveLength(2);
    expect(body.meRank).toBe(2); // u2 is the caller
    expect(callerScopedDb).toHaveBeenCalled();
  });

  it("401 when the Bearer token does not authenticate", async () => {
    (resolveApiAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (callerScopedDb as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect((await GET(bearerReq())).status).toBe(401);
  });
});
