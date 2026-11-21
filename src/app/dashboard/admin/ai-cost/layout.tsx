import { notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { getVendorCompanyId, isVendorAdmin } from "@/lib/crm/vendorAuth";

export const dynamic = "force-dynamic";

/**
 * Layout for /dashboard/admin/ai-cost — the vendor AI cost view (RSS Phase 0 step 6, Gong F28.7).
 * Same vendor-admin gate as the CRM and monitoring shells, and notFound() rather than a redirect so a
 * customer admin who guesses the URL learns nothing that this surface exists. AI cost is ELOSTATE's
 * operating data and is never shown to a tenant. The data is independently 403-gated by requireVendorAdmin
 * on /api/admin/ai-cost and /api/admin/ai-cost/prices.
 */
export default async function AdminAiCostLayout({
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
