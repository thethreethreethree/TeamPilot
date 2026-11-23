import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { cleanReport } from "@/lib/security/report";

/**
 * POST /api/security-report — the public vulnerability-disclosure form (/security, linked from
 * /.well-known/security.txt; 2026-11-23, migration 0312). No account needed: researchers usually have none.
 * Rate-limited per address; a filled hidden field ("website") marks a bot, which is answered as if accepted and
 * stored nowhere. Inserted with the service role into a sealed table only the founders' inbox reads. No IP stored.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "security-report", windowMs: 10 * 60_000, max: 5 });
  if (limited) return limited;
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof b.website === "string" && b.website.trim()) return NextResponse.json({ ok: true, reference: null });
  const r = cleanReport(b);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("security_reports")
    .insert({ summary: r.summary, details: r.details, affected: r.affected, reporter_name: r.reporterName, reporter_contact: r.reporterContact })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error(`[security-report] insert failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Your report could not be saved. Please try again in a few minutes." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, reference: String(data.id).slice(0, 8).toUpperCase() });
}
