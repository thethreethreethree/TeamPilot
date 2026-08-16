import { NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import {
  listMonitorableCompanies,
  logMonitoringAccess,
} from "@/lib/monitoring/vendorMonitoring";

/**
 * GET /api/admin/monitoring/companies
 *
 * Founder-monitoring (0214 exemption): the companies a vendor super-admin may monitor —
 * the allowlist seeded from EXISTING companies. Vendor-super-admin only (requireVendorAdmin
 * = admin of the vendor company = the two founders). New customers are absent until a
 * founder adds them deliberately.
 */
export async function GET() {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;

  const companies = await listMonitorableCompanies();
  await logMonitoringAccess({ actor: gate.userId, resource: "companies_list" });
  return NextResponse.json({ companies });
}
