import { describe, expect, it } from "vitest";
import { isAdminRole, ADMIN_ROLES } from "../auth-helpers";

/**
 * The canonical company-admin role check (§A13 — the role vocabulary resolved
 * once). Pinned so the set and the exact-match semantics can't drift: the three
 * leadership roles are admin; everything else — including near-misses like "Lead"
 * or "administrator", and null/empty — is not. New gates should adopt this; the
 * ~12 sites that still inline the check can migrate to it incrementally.
 */
describe("isAdminRole", () => {
  it("admits exactly the leadership roles", () => {
    expect(ADMIN_ROLES).toEqual(["CEO", "COO", "admin"]);
    for (const role of ADMIN_ROLES) expect(isAdminRole(role)).toBe(true);
  });

  it("rejects near-miss and non-admin roles (no accidental broadening)", () => {
    for (const role of ["Lead", "Member", "administrator", "Admin", "ceo", ""])
      expect(isAdminRole(role)).toBe(false);
  });

  it("rejects null / undefined safely", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
