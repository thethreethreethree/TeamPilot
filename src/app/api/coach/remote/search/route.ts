import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { parseCallSearch, runCallSearch } from "@/lib/coach/remote/search";

/**
 * GET /api/coach/remote/search?q=&channel=&rep=&outcome=&from=&to=&scoreMin=&scoreMax=&tracker= — find calls by
 * what was said and how they went (RSS Phase 5). Read entirely through the CALLER's client: RLS (and the 0273
 * reporting tree) decides what is searchable. See src/lib/coach/remote/search.ts.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-search", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const parsed = parseCallSearch(new URL(req.url).searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await runCallSearch(callerScopedDb(req) ?? (await createClient()), parsed.filters);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ rows: result.rows, truncated: result.truncated, narrower: !!result.narrower });
}
