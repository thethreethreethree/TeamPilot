import { describe, it, expect } from "vitest";
import { isCompanyAdminRole } from "../useCurrentUserRole";

/**
 * isCompanyAdminRole is the CENTRALIZED company-admin predicate — per its own comment it's the same check used
 * by /api/admin/team-check, /api/feedback/[id], and sidebar gating. A regression here mis-grants or mis-denies
 * admin powers across multiple surfaces, so its exact behavior is worth pinning. (The React hook in the same
 * file needs a DOM; this tests only the pure predicate.)
 */

describe("isCompanyAdminRole", () => {
  it("grants admin to CEO / COO / admin", () => {
    for (const r of ["CEO", "COO", "admin"]) expect(isCompanyAdminRole(r)).toBe(true);
  });

  it("denies non-admin roles", () => {
    for (const r of ["Lead", "Member"]) expect(isCompanyAdminRole(r)).toBe(false);
  });

  it("fails closed on null / undefined / empty (no role → not admin)", () => {
    expect(isCompanyAdminRole(null)).toBe(false);
    expect(isCompanyAdminRole(undefined)).toBe(false);
    expect(isCompanyAdminRole("")).toBe(false);
  });

  it("is exact-match / case-sensitive (a mis-cased role does NOT get admin)", () => {
    for (const r of ["ceo", "Admin", "COO ", "administrator"]) expect(isCompanyAdminRole(r)).toBe(false);
  });
});
