import { describe, expect, it } from "vitest";
import { isVendorAdmin } from "../vendorAuth";

/**
 * Pins the fix for the CRITICAL vendor-CRM authorization hole (audit
 * 2026-07-07): the /api/admin/crm/* routes gated only on per-company isAdmin,
 * so ANY customer company's admin could read + mutate the vendor's entire
 * cross-customer CRM. The correct predicate is admin AND company === vendor.
 */
const VENDOR = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
const OTHER = "00000000-0000-0000-0000-000000000000";

describe("isVendorAdmin", () => {
  it("admits a vendor-company admin", () => {
    expect(isVendorAdmin({ isAdmin: true, companyId: VENDOR }, VENDOR)).toBe(true);
  });

  it("REJECTS an admin of a different company (the vulnerability)", () => {
    // The exact escalation the fix closes: a customer admin is still isAdmin,
    // but their company is not the vendor's — they must be denied.
    expect(isVendorAdmin({ isAdmin: true, companyId: OTHER }, VENDOR)).toBe(false);
  });

  it("rejects a non-admin even in the vendor company", () => {
    expect(isVendorAdmin({ isAdmin: false, companyId: VENDOR }, VENDOR)).toBe(false);
  });

  it("rejects a null context (fail closed)", () => {
    expect(isVendorAdmin(null, VENDOR)).toBe(false);
  });

  it("rejects an empty companyId (fail closed)", () => {
    expect(isVendorAdmin({ isAdmin: true, companyId: "" }, VENDOR)).toBe(false);
  });
});
