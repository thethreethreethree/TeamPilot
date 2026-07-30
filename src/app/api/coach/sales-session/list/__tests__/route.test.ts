import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/list — the session list. Previously untested. It reads via the ADMIN client
 * (bypasses RLS), so the ROUTE must scope the query itself: a non-manager rep is confined to their OWN
 * sessions (`.eq("agent_id", userId)`), while a manager sees the whole company. A regression dropping that rep
 * filter would leak every teammate's sessions to every rep. This is NOT the `?agentId=` shape INV6 guards, so
 * it needs its own lock. isSalesCoachManager is the real predicate; the query is captured to assert the scope.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "../route";

const setCaller = (userId: string | null, profile: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
  });

/** Capture every .eq(col,val) on the coaching_sessions query; return an empty list so the downstream
 *  badge/signal queries (guarded by subjects.length) are skipped. */
let eqCalls: Array<{ col: string; val: unknown }>;
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.gte = () => chain;
      chain.in = () => chain;
      chain.eq = (col: string, val: unknown) => {
        eqCalls.push({ col, val });
        return chain;
      };
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
      return chain;
    },
  });

const req = () => ({ url: "https://x/api/coach/sales-session/list" }) as unknown as Parameters<typeof GET>[0];
const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls = [];
  mockAdmin();
});

describe("GET /list — session scope", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    expect((await GET(req())).status).toBe(401);
  });

  it("a REP's query is scoped to company AND their own agent_id (no peer sessions)", async () => {
    setCaller("rep1", REP);
    await GET(req());
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
    expect(eqCalls).toContainEqual({ col: "agent_id", val: "rep1" });
  });

  it("a MANAGER's query is company-scoped but NOT agent-filtered (sees the whole team)", async () => {
    setCaller("boss", MANAGER);
    await GET(req());
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
    expect(eqCalls.some((c) => c.col === "agent_id")).toBe(false);
  });
});
