import "server-only";
import { NextResponse } from "next/server";
import {
  getCurrentAuthContext,
  type AuthContext,
} from "@/lib/supabase/auth-helpers";

/**
 * Vendor back-office (CRM) authorization.
 *
 * WHY (audit 2026-07-07, CRITICAL): the /api/admin/crm/* routes manage the
 * VENDOR's cross-customer CRM — every company on the platform, their contact
 * PII, subscriptions, MRR, and invoices — via the service-role client (which
 * BYPASSES RLS). They gated only on `ctx.isAdmin`, which is
 * `role in ('CEO','COO','admin')` for the caller's OWN company. So ANY customer
 * company's admin could read and mutate the entire vendor CRM (list every other
 * customer + emails + MRR, change any account's plan, delete contacts, generate
 * invoices). The DB's own `is_vendor_super_admin()` had the identical gap — its
 * comment says "AND their company being the ELOSTATE company" but the SQL never
 * checked the company (fixed in migration 0089).
 *
 * The missing predicate: vendor admin = an admin whose company IS the vendor
 * (deployment home) company. This module is the single source of truth for that
 * check (§A13 — author the space once). It fails CLOSED: any uncertainty denies,
 * because a locked-out vendor admin is a visible, non-destructive error the
 * operator corrects in seconds, whereas a silent broad-open is a cross-tenant
 * breach.
 */

// The deployment's home / vendor company. SAME resolution the C.A.R.E tenant
// layer uses for "our own company" (care/config.ts), so a deployment that
// overrides the home company via CARE_DEFAULT_TENANT_ID stays consistent and
// its real vendor admins are never locked out.
const ELOSTATE_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";

export function getVendorCompanyId(): string {
  return process.env.CARE_DEFAULT_TENANT_ID ?? ELOSTATE_COMPANY_ID;
}

/**
 * Pure predicate — a caller is a vendor admin iff they are an admin AND their
 * company is the vendor company. Exported for unit tests.
 */
export function isVendorAdmin(
  ctx: Pick<AuthContext, "isAdmin" | "companyId"> | null,
  vendorCompanyId: string
): boolean {
  if (!ctx) return false;
  if (!ctx.isAdmin) return false;
  if (!ctx.companyId) return false;
  return ctx.companyId === vendorCompanyId;
}

/**
 * Route gate. Returns the AuthContext when the caller is a vendor admin, or a
 * ready-to-return NextResponse (401/403) otherwise. Usage:
 *
 *   const gate = await requireVendorAdmin();
 *   if (gate instanceof NextResponse) return gate;
 *   const ctx = gate;
 */
export async function requireVendorAdmin(): Promise<AuthContext | NextResponse> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isVendorAdmin(ctx, getVendorCompanyId())) {
    // Deliberately identical message + status whether the caller is a non-admin
    // or an admin of the wrong company — don't leak which axis failed, and don't
    // confirm to a customer admin that a vendor CRM exists they can't reach.
    return NextResponse.json(
      { error: "CRM is vendor-side back-office only." },
      { status: 403 }
    );
  }
  return ctx;
}
