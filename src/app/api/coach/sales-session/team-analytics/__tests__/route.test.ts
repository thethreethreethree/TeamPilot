import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/team-analytics — the manager team dashboard (aggregate-only; the only per-person
 * number is a COUNT of active coaches, no per-person private data). Routine surface-completion coverage of its
 * gate: 403 a rep, and the admin-client aggregation is company-scoped. isSalesCoachManager is the real predicate.
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

let eqCalls: Array<{ col: string; val: unknown }>;
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.gte = () => chain;
      chain.lt = () => chain;
      chain.in = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.eq = (col: string, val: unknown) => {
        eqCalls.push({ col, val });
        return chain;
      };
      // resolves for both data queries and count/head queries
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null });
      return chain;
    },
  });

const REP = { role: "member", company_id: "co1", sales_coach_role: null };
const MANAGER = { role: "admin", company_id: "co1", sales_coach_role: null };

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls = [];
  mockAdmin();
});

describe("GET /team-analytics — manager gate", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    expect((await GET()).status).toBe(401);
  });

  it("403 for a rep (managers only)", async () => {
    setCaller("rep1", REP);
    expect((await GET()).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("200 for a manager, aggregation company-scoped", async () => {
    setCaller("boss", MANAGER);
    expect((await GET()).status).toBe(200);
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
  });
});
