import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
import { isVendorAdmin, requireVendorAdmin } from "../vendorAuth";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { NextResponse } from "next/server";

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

/**
 * The pure predicate above is the logic; requireVendorAdmin is the GATE the routes actually call — it
 * composes getCurrentAuthContext + isVendorAdmin and returns 401 / 403 / the AuthContext. The predicate
 * being correct is worthless if the gate doesn't invoke it or mis-maps its result, so lock the wiring: an
 * unauthenticated caller gets 401, a customer-company admin gets 403 (fail-closed, so a route never runs
 * its service-role body), and only a real vendor admin gets the context back to proceed.
 */
const auth = getCurrentAuthContext as unknown as ReturnType<typeof vi.fn>;
describe("requireVendorAdmin — the route gate", () => {
  const savedEnv = process.env.CARE_DEFAULT_TENANT_ID;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CARE_DEFAULT_TENANT_ID = VENDOR; // deterministic vendor company
  });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.CARE_DEFAULT_TENANT_ID;
    else process.env.CARE_DEFAULT_TENANT_ID = savedEnv;
  });

  it("401 when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    const res = await requireVendorAdmin();
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
  });

  it("403 for a customer-company admin (fail-closed — the 0089 escalation, at the gate)", async () => {
    auth.mockResolvedValue({ isAdmin: true, companyId: OTHER, userId: "u1" });
    const res = await requireVendorAdmin();
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns the AuthContext (NOT a NextResponse) for a real vendor admin", async () => {
    const ctx = { isAdmin: true, companyId: VENDOR, userId: "vendor-user" };
    auth.mockResolvedValue(ctx);
    const res = await requireVendorAdmin();
    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toBe(ctx);
  });
});
