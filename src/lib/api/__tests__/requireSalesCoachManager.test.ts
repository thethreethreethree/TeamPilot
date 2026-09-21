import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The manager gate, resolved in one place.
 *
 * The point of this helper is that it does NOT express the rule — `isSalesCoachManager` does, and
 * this fetches the column the rule needs. So the tests that matter are the ones proving it defers:
 * every branch of the authority must come through unchanged, including the one a local copy
 * dropped (the calibration route's `ctx.isAdmin || sales_coach_role === "admin"`, which agreed
 * with the authority only for as long as the authority did not change).
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/api/resolveApiAuth", () => ({ resolveApiAuth: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "../requireSalesCoachManager";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const setProfile = (row: unknown) =>
  asMock(createAdminClient).mockReturnValue({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: row, error: null });
      return chain;
    },
  });

const setAuth = (ctx: unknown) => asMock(resolveApiAuth).mockResolvedValue(ctx);

const req = () => new Request("http://localhost/x");

beforeEach(() => {
  vi.clearAllMocks();
  setProfile(null);
});

describe("who gets through", () => {
  it("a Sales-Coach admin", async () => {
    setAuth({ userId: "u1", companyId: "c1", role: "member", isAdmin: false });
    setProfile({ sales_coach_role: "admin" });
    expect(await requireSalesCoachManager(req())).toEqual({ userId: "u1", companyId: "c1" });
  });

  it("a company leader with no sales_coach_role at all", async () => {
    setAuth({ userId: "boss", companyId: "c1", role: "CEO", isAdmin: true });
    setProfile({ sales_coach_role: null });
    expect(await requireSalesCoachManager(req())).toEqual({ userId: "boss", companyId: "c1" });
  });

  it("a company leader even when the profile row fails to load", async () => {
    // Short-circuiting on a missing profile would lock out a CEO because of a transient read.
    // The authority still has ctx.role, so it can still answer.
    setAuth({ userId: "boss", companyId: "c1", role: "COO", isAdmin: true });
    setProfile(null);
    expect(await requireSalesCoachManager(req())).toEqual({ userId: "boss", companyId: "c1" });
  });
});

describe("who does not", () => {
  it("an unauthenticated caller", async () => {
    setAuth(null);
    expect(await requireSalesCoachManager(req())).toBeNull();
  });

  it("a staff rep — a Sales Coach MEMBER is not a Sales Coach MANAGER", async () => {
    // The distinction the authority's own docblock insists on: conflating member with manager
    // would hand every staff rep the manager surfaces.
    setAuth({ userId: "rep", companyId: "c1", role: "member", isAdmin: false });
    setProfile({ sales_coach_role: "staff" });
    expect(await requireSalesCoachManager(req())).toBeNull();
  });

  it("a plain member with no coaching role", async () => {
    setAuth({ userId: "u2", companyId: "c1", role: "member", isAdmin: false });
    setProfile({ sales_coach_role: null });
    expect(await requireSalesCoachManager(req())).toBeNull();
  });
});

describe("it defers to the authority rather than re-expressing it", () => {
  it("agrees with isSalesCoachManager on every combination", async () => {
    // The drift guard. If someone adds a term to the authority and not to this helper — or writes
    // a second copy of the rule here — this fails, which is the whole reason the helper exists.
    const roles = [null, "member", "CEO", "COO", "admin"];
    const coachRoles = [null, "staff", "admin"];
    for (const role of roles) {
      for (const sales_coach_role of coachRoles) {
        setAuth({ userId: "u", companyId: "c1", role, isAdmin: role === "CEO" || role === "COO" || role === "admin" });
        setProfile({ sales_coach_role });
        const got = (await requireSalesCoachManager(req())) !== null;
        const want = isSalesCoachManager({ role, sales_coach_role, company_id: "c1" });
        expect(got, `role=${role} sales_coach_role=${sales_coach_role}`).toBe(want);
      }
    }
  });

  it("returns the caller's OWN company, never one from the request", async () => {
    // A tenant id that could come from the caller is the INVARIANT 4 shape. It comes from the
    // resolved session and nowhere else.
    setAuth({ userId: "u1", companyId: "the-real-one", role: "CEO", isAdmin: true });
    setProfile({ sales_coach_role: "admin" });
    const r = await requireSalesCoachManager(
      new Request("http://localhost/x?companyId=someone-elses")
    );
    expect(r?.companyId).toBe("the-real-one");
  });
});
