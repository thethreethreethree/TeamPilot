import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/coach/kpi/team — the MANAGER rollup. Security boundary: a non-manager must NOT see the team's
 * per-agent KPIs. These lock the two deny paths (unauthenticated → 401; authenticated non-manager → 403)
 * against a future refactor silently opening the gate. isSalesCoachManager is the REAL pure function; we
 * only feed it a non-manager profile.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET } from "../route";

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/** Fake supabase whose profiles read returns the given role row. */
const setProfile = (row: unknown) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }),
    }),
  });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/coach/kpi/team — manager gate", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setProfile(null);
    expect((await GET()).status).toBe(401);
  });

  it("403 for an authenticated NON-manager (member with no sales-coach admin)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setProfile({ role: "member", sales_coach_role: null, company_id: "co1" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("a company admin is treated as a manager (does NOT 403 at the gate)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: true });
    // A CEO/COO/admin OR sales_coach_role='admin' passes isSalesCoachManager. Past the gate it queries
    // members; our stub returns the same row shape (maybeSingle) for every from() call, so `.not(...)` etc.
    // must exist — provide a permissive chain that resolves to an empty member list → { agents: [] }.
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.not = () => chain;
        chain.in = () => chain;
        chain.order = () => chain;
        chain.maybeSingle = async () => ({ data: { role: "admin", sales_coach_role: null, company_id: "co1" } });
        chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [] }); // awaited query → empty list
        return chain;
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agents: [] });
  });
});
