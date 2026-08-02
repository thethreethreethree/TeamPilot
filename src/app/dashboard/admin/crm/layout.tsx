import { notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { getVendorCompanyId, isVendorAdmin } from "@/lib/crm/vendorAuth";

export const dynamic = "force-dynamic";

/**
 * Layout for /dashboard/admin/crm/* — the VENDOR-side CRM (cross-tenant customer accounts),
 * which lives under the company-admin /dashboard tree but is vendor-tier tooling.
 *
 * Server-side vendor-admin gate mirroring /founder/* and the CRM API's own `requireVendorAdmin`
 * (the IDENTICAL predicate: `isVendorAdmin(ctx, getVendorCompanyId())`, so any vendor who passes
 * the API passes here — a real vendor admin is never locked out). `notFound()` rather than a
 * redirect so a customer admin who guesses the URL learns nothing — the SAME posture the CRM
 * route states in-code ("don't confirm to a customer admin that a vendor CRM exists they can't
 * reach").
 *
 * WHY this exists: the CRM pages are client shells and the parent /dashboard layout only gates
 * auth+onboarding, so before this the vendor-CRM shell RENDERED for any company admin. The data
 * was already 403-gated by every CRM route (0089), so there was no data leak — this closes the
 * shell/existence exposure the API deliberately avoids, aligning the surface with the boundary.
 */
export default async function AdminCrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentAuthContext();
  if (!isVendorAdmin(ctx, getVendorCompanyId())) {
    notFound();
  }
  return <>{children}</>;
}
