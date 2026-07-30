import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/coach/sales-session/quota — the company's monthly deals-won target (KPI Quota source).
 * Security boundary: PATCH is a company-wide WRITE, so a non-manager must NOT be able to set the team's quota.
 * These lock: GET/PATCH 401 unauthenticated, PATCH 403 for a non-manager, PATCH 200 for a manager, and that
 * the zod schema rejects a bad target — so a future refactor can't silently open the write or drop validation.
 * isSalesCoachManager + the zod schema are the REAL implementations; only the supabase client + auth are faked.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { GET, PATCH } from "../route";

const setAuth = (v: unknown) =>
  (getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(v);

/**
 * Fake supabase. `profileRow` is what the manager-gate read returns; `companyTarget` is the GET read; captures
 * the last companies.update() payload so the write can be asserted.
 */
const captured: { update?: Record<string, unknown> } = {};
const setDb = (profileRow: unknown, companyTarget: number | null) =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: (t: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.update = (payload: Record<string, unknown>) => {
        captured.update = payload;
        return chain;
      };
      chain.maybeSingle = async () =>
        t === "profiles"
          ? { data: profileRow, error: null }
          : { data: { sales_coach_monthly_deal_target: companyTarget }, error: null };
      // Awaited update (companies) → success.
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ error: null });
      return chain;
    },
  });

const req = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0];

beforeEach(() => {
  vi.clearAllMocks();
  captured.update = undefined;
});

describe("GET /api/coach/sales-session/quota", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setDb(null, null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the company's target for an authenticated caller", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setDb({ role: "member", sales_coach_role: null, company_id: "co1" }, 12);
    const body = await (await GET()).json();
    expect(body.target).toBe(12);
  });
});

describe("PATCH /api/coach/sales-session/quota — manager write gate", () => {
  it("401 when unauthenticated", async () => {
    setAuth(null);
    setDb(null, null);
    expect((await PATCH(req({ target: 10 }))).status).toBe(401);
  });

  it("403 for an authenticated NON-manager (a rep cannot set the team quota)", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setDb({ role: "member", sales_coach_role: null, company_id: "co1" }, null);
    const res = await PATCH(req({ target: 10 }));
    expect(res.status).toBe(403);
    expect(captured.update).toBeUndefined(); // never reached the write
  });

  it("200 for a manager and writes the target", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setDb({ role: "admin", sales_coach_role: null, company_id: "co1" }, null);
    const res = await PATCH(req({ target: 15 }));
    expect(res.status).toBe(200);
    expect(captured.update).toEqual({ sales_coach_monthly_deal_target: 15 });
  });

  it("accepts null (clearing the target) from a manager", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setDb({ role: "admin", sales_coach_role: null, company_id: "co1" }, null);
    const res = await PATCH(req({ target: null }));
    expect(res.status).toBe(200);
    expect(captured.update).toEqual({ sales_coach_monthly_deal_target: null });
  });

  it("400 on an invalid target (negative / non-integer / out of range) — never written", async () => {
    setAuth({ userId: "u1", companyId: "co1", isAdmin: false });
    setDb({ role: "admin", sales_coach_role: null, company_id: "co1" }, null);
    expect((await PATCH(req({ target: -5 }))).status).toBe(400);
    expect((await PATCH(req({ target: 3.5 }))).status).toBe(400);
    expect((await PATCH(req({ target: 999999 }))).status).toBe(400); // above the max
    expect(captured.update).toBeUndefined();
  });
});
