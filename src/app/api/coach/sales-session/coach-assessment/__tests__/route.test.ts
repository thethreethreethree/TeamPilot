import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/sales-session/coach-assessment — the manager's team-wide coaching read-out. Routine coverage
 * of its gate: it 403s a rep (the endpoint IS the gate the page reads), and its admin-client team read is
 * company-scoped. isSalesCoachManager is the real predicate; the admin query's .eq is captured.
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

/** Admin team read returns an empty roster (so the downstream event queries are skipped); capture its .eq. */
let eqCalls: Array<{ col: string; val: unknown }>;
const mockAdmin = () =>
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.in = () => chain;
      chain.eq = (col: string, val: unknown) => {
        eqCalls.push({ col, val });
        return chain;
      };
      chain.is = async () => ({ data: [], error: null });
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
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

describe("GET /coach-assessment — manager gate", () => {
  it("401 unauthenticated", async () => {
    setCaller(null, null);
    expect((await GET()).status).toBe(401);
  });

  it("403 for a rep (Coach Assessment is admins-only)", async () => {
    setCaller("rep1", REP);
    expect((await GET()).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled(); // never reaches the team read
  });

  it("200 for a manager, and the team read is company-scoped", async () => {
    setCaller("boss", MANAGER);
    expect((await GET()).status).toBe(200);
    expect(eqCalls).toContainEqual({ col: "company_id", val: "co1" });
  });
});
