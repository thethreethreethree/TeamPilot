import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { callSearchCsv, parseCallSearch, runCallSearch } from "@/lib/coach/remote/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit/recordAudit";

/**
 * GET /api/coach/remote/search/export?<same filters> — the search as CSV, for managers (RSS Phase 5, docs/06 "Export
 * CSV for managers"). The same runCallSearch as the page, through the caller's client, so the file can never hold
 * a call the manager could not open. Formula-leading cells are neutralised: callSearchCsv builds the file with toCsv
 * (→ neutralizeCsvFormula, CWE-1236), never a local copy of the guard.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-search-export", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const parsed = parseCallSearch(new URL(req.url).searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await runCallSearch(callerScopedDb(req) ?? (await createClient()), { ...parsed.filters, remoteOnly: true }); // Remote Sales: phone and video calls only
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const day = new Date().toISOString().slice(0, 10);
  // What left the building: the filters and the row count, never the rows themselves.
  await recordAudit(createAdminClient(), {
    companyId: mgr.companyId,
    actorId: mgr.userId,
    action: "session.export",
    objectType: "call_search",
    objectId: day,
    meta: { filters: parsed.filters, rows: result.rows.length, truncated: result.truncated },
  });
  return new NextResponse(callSearchCsv(result.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
