import { NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { waitingCount } from "@/lib/security/report";

/**
 * GET /api/admin/security-reports/waiting — how many public security reports have no response recorded yet (2026-11-23;
 * OPEN.md "security reports have no alert"). Drives the count on the sidebar's "Security reports" for the founders, so a
 * report doesn't sit unseen until someone opens the inbox. In-app, per D10 (alerts in-app only). Vendor admins only;
 * the tables are sealed, so the service role reads them here behind requireVendorAdmin. A failed read is a 500 — the
 * sidebar then shows no count rather than a false zero.
 */
export async function GET() {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = createAdminClient();
  // Every row, paged (a capped read would undercount — the exact false "all clear" this badge exists to prevent).
  const [reports, events] = await Promise.all([
    fetchAllPagedResult<{ id: string }>((from, to) => admin.from("security_reports").select("id").order("id").range(from, to), { label: "security reports" }),
    fetchAllPagedResult<{ report_id: string }>((from, to) => admin.from("security_report_events").select("report_id").order("id").range(from, to), { label: "security report events" }),
  ]);
  if (reports.error || events.error) {
    console.error(`[security-reports/waiting] read failed: ${reports.error?.message ?? events.error?.message}`);
    return NextResponse.json({ error: "Couldn't count the security reports." }, { status: 500 });
  }
  return NextResponse.json({ waiting: waitingCount((reports.data ?? []).map((r) => r.id), events.data ?? []) });
}
