import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { summarizeUsage, USAGE_DAYS, USAGE_MAX_ROWS, type UsageRow } from "@/lib/api/usageReport";

/**
 * GET /api/coach/remote/settings/api-keys/usage — the API usage report (Engage plan E7; Gong F31.9). Company admins only.
 *   → { days, lines: [{ keyId, route, requests, errors, limited }], partial } over the last 7 days.
 * Service-role read after the admin check, pinned to the admin's company (as the keys list beside it). Newest rows first,
 * at most USAGE_MAX_ROWS; `partial` says when there were more, so a busy key's count isn't read as the whole week.
 */
const PAGE = 1000;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "api-keys-usage", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can see API usage." }, { status: 403 });
  const admin = createAdminClient();
  const since = new Date(Date.now() - USAGE_DAYS * 86_400_000).toISOString();
  const rows: UsageRow[] = [];
  let partial = false;
  // Keyset paging (newest first, each page below the last id seen): a request logged while this reads can't shift a
  // page and be counted twice, as offsets would.
  let before: number | null = null;
  for (;;) {
    if (rows.length >= USAGE_MAX_ROWS) {
      // Partial only if a row is really left (review 2026-11-27): exactly the cap is the whole week.
      const { data: more, error: mErr } = await admin.from("api_usage").select("id").eq("company_id", ctx.companyId).gte("at", since).lt("id", before!).limit(1);
      if (mErr) return NextResponse.json({ error: "Couldn't load API usage." }, { status: 500 });
      partial = (more ?? []).length > 0;
      break;
    }
    let q = admin.from("api_usage").select("id, key_id, route, status").eq("company_id", ctx.companyId).gte("at", since);
    if (before !== null) q = q.lt("id", before);
    const { data, error } = await q.order("id", { ascending: false }).limit(PAGE);
    if (error) return NextResponse.json({ error: "Couldn't load API usage." }, { status: 500 });
    const page = (data ?? []) as Array<UsageRow & { id: number }>;
    rows.push(...page);
    if (page.length < PAGE) break;
    before = page[page.length - 1]!.id;
  }
  return NextResponse.json({ days: USAGE_DAYS, lines: summarizeUsage(rows), partial });
}
