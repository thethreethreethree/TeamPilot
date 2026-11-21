import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { parseCallSearch } from "@/lib/coach/remote/search";

/**
 * /api/coach/remote/saved-searches — a person's own named searches (RSS Phase 5, Gong F12.2; 0280).
 *   GET   → { available, searches: [{ id, name, query }] } (not removed, newest first)
 *   POST  { name, query } → saves. `query` is the search's query string, validated by the same parseCallSearch.
 *   PATCH { id } → removes (stamps removed_at once; a trigger forbids any other change).
 * Owner and company are stamped from auth; every statement names both (INV29).
 */
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-saved-searches", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("saved_searches")
    .select("id, name, filters, created_at")
    .eq("company_id", ctx.companyId)
    .eq("owner_id", ctx.userId)
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, searches: [] });
    console.error(`[saved-searches] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load saved searches." }, { status: 500 });
  }
  return NextResponse.json({
    available: true,
    searches: ((data ?? []) as Array<{ id: string; name: string; filters: { query?: string } }>).map((s) => ({
      id: s.id,
      name: s.name,
      query: typeof s.filters?.query === "string" ? s.filters.query : "",
    })),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-saved-searches-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let body: { name?: unknown; query?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const query = typeof body.query === "string" ? body.query.replace(/^\?/, "") : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Give the search a name (up to 60 characters)." }, { status: 400 });
  const parsed = parseCallSearch(new URLSearchParams(query));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("saved_searches")
    .insert({ company_id: ctx.companyId, owner_id: ctx.userId, name, filters: { query } })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: "Saved searches are waiting on database migration 0280." }, { status: 503 });
    console.error(`[saved-searches] insert failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't save the search." }, { status: 500 });
  }
  return NextResponse.json({ search: { id: data.id, name, query } });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-saved-searches-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Which search?" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("saved_searches")
    .update({ removed_at: new Date().toISOString() })
    .eq("company_id", ctx.companyId)
    .eq("owner_id", ctx.userId)
    .eq("id", id)
    .is("removed_at", null)
    .select("id");
  if (error) {
    console.error(`[saved-searches] remove failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't remove the search." }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
