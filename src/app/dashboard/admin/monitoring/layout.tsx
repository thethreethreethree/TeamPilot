import { notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { getVendorCompanyId, isVendorAdmin } from "@/lib/crm/vendorAuth";

export const dynamic = "force-dynamic";

/**
 * Layout for /dashboard/admin/monitoring/* — the founder session-monitoring surface
 * (0214 exemption). Same vendor-admin gate as the CRM shell (identical predicate to the
 * monitoring APIs' requireVendorAdmin), and notFound() rather than a redirect so a customer
 * admin who guesses the URL learns nothing that this surface exists. The data itself is
 * independently 403-gated + allowlist-scoped + audited by every /api/admin/monitoring route;
 * this closes the shell/existence exposure to match that boundary.
 */
export default async function AdminMonitoringLayout({
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
