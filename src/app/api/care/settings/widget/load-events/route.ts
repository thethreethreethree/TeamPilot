import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { fetchWidgetLoadEvents } from "@/lib/data/careWidgetEvents";

/**
 * GET /api/care/settings/widget/load-events
 *
 * Admin-only (widget config + security telemetry is a leadership surface). Returns the tenant's recent
 * widget load events + a summary — including origin-rejected attempts (a stolen/guessed embed token
 * used off its allowed origins). Tenant-scoped by the authenticated companyId; never a client value.
 */
export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "No company on profile." }, { status: 403 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const summary = await fetchWidgetLoadEvents(auth.companyId);
  return NextResponse.json(summary);
}
