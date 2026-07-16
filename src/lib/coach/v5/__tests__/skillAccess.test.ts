import { describe, it, expect } from "vitest";
import { canManagerViewRepSkills, isSalesCoachManager } from "../skillAccess";

/**
 * Pins the §A18-crossing gate: a manager may read a rep's skills ONLY if manager AND same-company.
 * A future edit that drops either check fails here.
 */
const CO = "company-1";
const other = { company_id: "company-2" };
const sameTeam = { company_id: CO };

describe("isSalesCoachManager", () => {
  it("true for sales_coach_role=admin and for CEO/COO/admin company roles", () => {
    expect(isSalesCoachManager({ role: null, sales_coach_role: "admin", company_id: CO })).toBe(true);
    for (const role of ["CEO", "COO", "admin"]) {
      expect(isSalesCoachManager({ role, sales_coach_role: null, company_id: CO })).toBe(true);
    }
  });
  it("false for staff / member / null", () => {
    expect(isSalesCoachManager({ role: "Member", sales_coach_role: "staff", company_id: CO })).toBe(false);
    expect(isSalesCoachManager({ role: null, sales_coach_role: null, company_id: CO })).toBe(false);
  });
});

describe("canManagerViewRepSkills — the §A18 boundary", () => {
  const manager = { role: null, sales_coach_role: "admin", company_id: CO };

  it("ALLOWS a manager to view a same-company rep", () => {
    expect(canManagerViewRepSkills(manager, sameTeam)).toEqual({ ok: true });
  });

  it("REFUSES a non-manager (not-manager) even for a same-company target", () => {
    const staff = { role: "Member", sales_coach_role: "staff", company_id: CO };
    expect(canManagerViewRepSkills(staff, sameTeam)).toEqual({ ok: false, reason: "not-manager" });
  });

  it("REFUSES a manager viewing a CROSS-company rep (not-in-team — tenant boundary)", () => {
    expect(canManagerViewRepSkills(manager, other)).toEqual({ ok: false, reason: "not-in-team" });
  });

  it("REFUSES when target is null (RLS returned nothing for a cross-company id)", () => {
    expect(canManagerViewRepSkills(manager, null)).toEqual({ ok: false, reason: "not-in-team" });
  });

  it("REFUSES a manager with no company_id (can't establish the tenant match)", () => {
    const noCo = { role: null, sales_coach_role: "admin", company_id: null };
    expect(canManagerViewRepSkills(noCo, sameTeam)).toEqual({ ok: false, reason: "not-in-team" });
  });
});
