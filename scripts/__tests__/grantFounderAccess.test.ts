import { describe, it, expect } from "vitest";
import {
  evaluateGrant,
  hasFounderAccess,
  VENDOR_COMPANY_ID,
  GRANT_ROLE,
  ADMIN_ROLES,
} from "../grant-founder-access.mjs";

/**
 * Guard tests for the founder-access GRANT tool (a privilege escalation). The IO lives in main()
 * and does NOT run on import, so these exercise the pure decision in isolation. The point: the
 * guards on a privilege-escalation tool must not silently regress — if a future edit drops the
 * tenant guard or the name guard, one of these fails. (Same convention as scripts/__tests__/invariant-audit.)
 */

const OTHER_COMPANY = "00000000-0000-0000-0000-000000000000";
const moses = { id: "7da30c76", full_name: "Moses Maniquiz", role: "Member", company_id: VENDOR_COMPANY_ID };

describe("evaluateGrant — grant decision guards", () => {
  it("GRANTS an eligible member of the vendor company", () => {
    const d = evaluateGrant({ profile: moses, nameGuard: "Moses" });
    expect(d.action).toBe("grant");
  });

  it("name guard is case-insensitive + substring", () => {
    expect(evaluateGrant({ profile: moses, nameGuard: "moses" }).action).toBe("grant");
    expect(evaluateGrant({ profile: moses, nameGuard: "maniquiz" }).action).toBe("grant");
  });

  it("ABORTS when the name guard does not match the fetched profile (wrong-id protection)", () => {
    const d = evaluateGrant({ profile: moses, nameGuard: "Johns" });
    expect(d.action).toBe("abort");
    expect(d.reason).toMatch(/does not contain/i);
  });

  it("ABORTS when the profile is NOT in the vendor company (never moves tenants)", () => {
    const outsider = { ...moses, company_id: OTHER_COMPANY };
    const d = evaluateGrant({ profile: outsider, nameGuard: "Moses" });
    expect(d.action).toBe("abort");
    expect(d.reason).toMatch(/not the vendor company|tenant move/i);
  });

  it("ABORTS when the profile does not exist", () => {
    expect(evaluateGrant({ profile: null, nameGuard: "Moses" }).action).toBe("abort");
  });

  it("is a NO-OP when the profile already has an admin role (idempotent)", () => {
    for (const role of ADMIN_ROLES) {
      const d = evaluateGrant({ profile: { ...moses, role }, nameGuard: "Moses" });
      expect(d.action).toBe("noop");
    }
  });

  it("a wrong id that happens to be an admin in ANOTHER company still ABORTS (tenant guard wins)", () => {
    const outsideAdmin = { ...moses, role: "admin", company_id: OTHER_COMPANY };
    expect(evaluateGrant({ profile: outsideAdmin, nameGuard: "Moses" }).action).toBe("abort");
  });
});

describe("hasFounderAccess — the predicate mirrors isVendorAdmin + is_vendor_super_admin (0089)", () => {
  it("true only for an admin role IN the vendor company", () => {
    expect(hasFounderAccess({ role: GRANT_ROLE, company_id: VENDOR_COMPANY_ID })).toBe(true);
  });
  it("false for a member in the vendor company", () => {
    expect(hasFounderAccess({ role: "Member", company_id: VENDOR_COMPANY_ID })).toBe(false);
  });
  it("false for an admin in a DIFFERENT company (the exact 0089 hole this closes)", () => {
    expect(hasFounderAccess({ role: "admin", company_id: OTHER_COMPANY })).toBe(false);
  });
  it("false for null/undefined", () => {
    expect(hasFounderAccess(null)).toBe(false);
    expect(hasFounderAccess(undefined)).toBe(false);
  });
});
