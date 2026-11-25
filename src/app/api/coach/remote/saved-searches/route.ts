import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { parseCallSearch } from "@/lib/coach/remote/search";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { followStates, newMatches, type SearchEvent } from "@/lib/coach/remote/savedSearchFollow";

/**
 * /api/coach/remote/saved-searches — a person's own named searches (RSS Phase 5, Gong F12.2; 0280).
 *   GET   → { available, searches: [{ id, name, query, following, newCount, newCapped }] } (not removed, newest first).
 *           Followed searches (0342, F12.7) are run through the caller's OWN client for calls that started since the
 *           later of the follow and the last open — so the count obeys the reporting tree and hidden calls. newCount
 *           null = couldn't check (never shown as 0).
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
  const list = ((data ?? []) as Array<{ id: string; name: string; filters: { query?: string } }>).map((s) => ({
    id: String(s.id),
    name: s.name,
    query: typeof s.filters?.query === "string" ? s.filters.query : "",
  }));
  // Follow state (0342). A missing table reads as "nothing followed" only while the migration is absent.
  let states = new Map<string, { following: boolean; since: string | null }>();
  if (list.length) {
    // Paged: every event counts (an old follow must not fall off behind many "seen" rows).
    const admin = createAdminClient();
    const { data: evs, error: eErr } = await fetchAllPagedResult<SearchEvent>(
      (from, to) =>
        admin
          .from("saved_search_events")
          .select("search_id, kind, created_at")
          .eq("company_id", ctx.companyId)
          .eq("owner_id", ctx.userId)
          .in("search_id", list.map((s) => s.id))
          .order("id", { ascending: false })
          .range(from, to),
      { label: "saved-search events", maxRows: 20_000 },
    );
    const eCode = (eErr as { code?: string } | null)?.code;
    if (eErr && !MISSING.has(String(eCode)) && !/PGRST205|42P01|does not exist/.test(eErr.message)) {
      console.error(`[saved-searches] follow read failed: ${eErr.message}`);
      return NextResponse.json({ error: "Couldn't load saved searches." }, { status: 500 });
    }
    states = followStates(((evs ?? []) as SearchEvent[]).map((e) => ({ ...e, search_id: String(e.search_id) })));
  }
  const db = callerScopedDb(req) ?? (await createClient());
  const searches = await Promise.all(
    list.map(async (s) => {
      const st = states.get(s.id);
      if (!st?.following || !st.since) return { ...s, following: false, newCount: 0, newCapped: false };
      const m = await newMatches(db, s.query, st.since).catch(() => null);
      return { ...s, following: true, newCount: m ? m.count : null, newCapped: m ? m.capped : false };
    }),
  );
  return NextResponse.json({ available: true, searches });
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
  return NextResponse.json({ search: { id: data.id, name, query, following: false, newCount: 0, newCapped: false } });
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
