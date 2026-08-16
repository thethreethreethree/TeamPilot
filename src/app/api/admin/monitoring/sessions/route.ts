import { NextRequest, NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import {
  isCompanyMonitorable,
  listCompanySessions,
  logMonitoringAccess,
} from "@/lib/monitoring/vendorMonitoring";

/**
 * GET /api/admin/monitoring/sessions?companyId=…
 *
 * Founder-monitoring (0214 exemption): a monitorable company's sessions, newest first.
 * Vendor-super-admin only, AND the company must be on the allowlist — a company that is
 * not monitorable returns 404 (indistinguishable from "no such company"), so this cannot
 * be used to probe non-allowlisted tenants. Every access is audited.
 */
export async function GET(req: NextRequest) {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "Missing companyId." }, { status: 400 });
  }
  if (!(await isCompanyMonitorable(companyId))) {
    return NextResponse.json(
      { error: "Company not found or not monitorable." },
      { status: 404 }
    );
  }

  const sessions = await listCompanySessions(companyId);
  await logMonitoringAccess({
    actor: gate.userId,
    companyId,
    resource: "sessions_list",
  });
  return NextResponse.json({ sessions });
}
