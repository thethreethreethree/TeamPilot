import { NextRequest, NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import {
  getMonitoredSession,
  logMonitoringAccess,
} from "@/lib/monitoring/vendorMonitoring";

/**
 * GET /api/admin/monitoring/session/[id]
 *
 * Founder-monitoring (0214 exemption): one session's detail + transcript, for review.
 * Vendor-super-admin only. getMonitoredSession returns null unless the session's company
 * is on the allowlist, so a session in a non-monitorable tenant is a 404 — the allowlist
 * is the boundary, not the session id. Every access is audited (actor, company, session).
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const detail = await getMonitoredSession(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Session not found or not monitorable." },
      { status: 404 }
    );
  }

  await logMonitoringAccess({
    actor: gate.userId,
    companyId: detail.company_id,
    sessionId: id,
    resource: "session_detail",
  });
  return NextResponse.json({ session: detail.session, segments: detail.segments });
}
