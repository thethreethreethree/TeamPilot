import { notFound } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { getVendorCompanyId, isVendorAdmin } from "@/lib/crm/vendorAuth";

export const dynamic = "force-dynamic";

/**
 * Layout for /dashboard/admin/security — the founders' inbox of public security reports (0312). The same vendor-admin
 * predicate as /api/admin/security-reports (requireVendorAdmin), and notFound() rather than a redirect, so a customer
 * admin who guesses the URL learns nothing. The data is independently 403-gated by the API.
 */
export default async function AdminSecurityLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext();
  if (!isVendorAdmin(ctx, getVendorCompanyId())) notFound();
  return <>{children}</>;
}
