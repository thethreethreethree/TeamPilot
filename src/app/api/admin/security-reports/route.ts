import { NextRequest, NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { currentStatus, REPORT_STATUSES, type ReportStatus } from "@/lib/security/report";

/**
 * /api/admin/security-reports — the founders' inbox for public security reports (0312). Vendor admins only.
 *   GET → { reports: [{ id, reference, summary, details, affected, reporterName, reporterContact, receivedAt, status,
 *           note, statusAt }] } newest first.
 *   PUT { reportId, status, note? } → appends a status event (never an edit, §3.1).
 * The tables are sealed (no policy); the service role is the only reader, behind requireVendorAdmin.
 */
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET() {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const admin = createAdminClient();
  const [reports, events] = await Promise.all([
    admin.from("security_reports").select("id, summary, details, affected, reporter_name, reporter_contact, received_at").order("received_at", { ascending: false }).limit(500),
    admin.from("security_report_events").select("report_id, status, note, created_at").order("id", { ascending: true }).limit(1000),
  ]);
  if (reports.error && MISSING.has(String(reports.error.code))) return NextResponse.json({ reports: [], notReady: "Waiting on database migration 0312." });
  if (reports.error || events.error) {
    console.error(`[security-reports] read failed: ${reports.error?.message ?? events.error?.message}`);
    return NextResponse.json({ error: "Couldn't load the security reports." }, { status: 500 });
  }
  const st = currentStatus((events.data ?? []) as Array<{ report_id: string; status: string; note: string | null; created_at: string }>);
  type Row = { id: string; summary: string; details: string; affected: string | null; reporter_name: string | null; reporter_contact: string | null; received_at: string };
  return NextResponse.json({
    reports: ((reports.data ?? []) as Row[]).map((r) => {
      const s = st.get(r.id);
      return {
        id: r.id,
        reference: r.id.slice(0, 8).toUpperCase(),
        summary: r.summary,
        details: r.details,
        affected: r.affected,
        reporterName: r.reporter_name,
        reporterContact: r.reporter_contact,
        receivedAt: r.received_at,
        status: s?.status ?? "received",
        note: s?.note ?? null,
        statusAt: s?.at ?? null,
      };
    }),
  });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "security-reports-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  let b: { reportId?: unknown; status?: unknown; note?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const reportId = typeof b.reportId === "string" ? b.reportId : "";
  const status = (REPORT_STATUSES as readonly string[]).includes(String(b.status)) ? (b.status as ReportStatus) : null;
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
  if (!reportId || !status) return NextResponse.json({ error: "Name the report and a status." }, { status: 400 });
  const admin = createAdminClient();
  const { data: rep, error: rErr } = await admin.from("security_reports").select("id").eq("id", reportId).maybeSingle();
  if (rErr) {
    console.error(`[security-reports] report read failed: ${rErr.message}`);
    return NextResponse.json({ error: "Couldn't check the report." }, { status: 500 });
  }
  if (!rep) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const { error } = await admin.from("security_report_events").insert({ report_id: reportId, status, note, set_by: gate.userId });
  if (error) {
    console.error(`[security-reports] status write failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the status." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
