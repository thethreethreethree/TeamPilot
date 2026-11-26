import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { sharedNow, type ShareEvent } from "@/lib/coach/remote/savedSearchFollow";

/**
 * POST /api/coach/remote/saved-searches/events { id, kind } — on a saved search (0342/0362; Gong ledger F12.7):
 *   follow / unfollow / seen — your own search, or one shared with the company now; written under YOUR id.
 *   share / unshare — your own search, managers only: put it in front of the team or take it back.
 * Not on a removed search. Company and person from the session; append-only.
 */
const Body = z.object({ id: z.string().uuid(), kind: z.enum(["follow", "unfollow", "seen", "share", "unshare"]) });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-saved-search-events", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const admin = createAdminClient();
  const { data: s, error } = await admin
    .from("saved_searches")
    .select("id, owner_id")
    .eq("company_id", ctx.companyId)
    .eq("id", body.id)
    .is("removed_at", null)
    .maybeSingle();
  if (error) {
    console.error(`[saved-search-events] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't update the search." }, { status: 500 });
  }
  if (!s) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  const mine = String(s.owner_id) === ctx.userId;
  if (body.kind === "share" || body.kind === "unshare") {
    if (!mine) return NextResponse.json({ error: "Search not found." }, { status: 404 });
    if ((await requireSalesCoachManager(req)) === null) return NextResponse.json({ error: "Only a manager can share a search with the team." }, { status: 403 });
    const { error: shErr } = await admin.from("saved_search_shares").insert({ company_id: ctx.companyId, search_id: body.id, kind: body.kind, actor_id: ctx.userId });
    if (shErr) {
      console.error(`[saved-search-events] share failed: ${shErr.message}`);
      return NextResponse.json({ error: "Couldn't share the search." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, kind: body.kind });
  }
  // Someone else's search: only while it is shared now (0362, the same verdict as the list).
  if (!mine) {
    const { data: ev, error: evErr } = await fetchAllPagedResult<ShareEvent>(
      (from, to) => admin.from("saved_search_shares").select("id, search_id, kind").eq("company_id", ctx.companyId).eq("search_id", body.id).order("id", { ascending: true }).range(from, to),
      { label: "saved-search share check", maxRows: 10_000 },
    );
    if (evErr) {
      console.error(`[saved-search-events] share check failed: ${evErr.message}`);
      return NextResponse.json({ error: "Couldn't update the search." }, { status: 500 });
    }
    if (!sharedNow(((ev ?? []) as ShareEvent[]).map((e) => ({ ...e, search_id: String(e.search_id) }))).has(body.id)) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }
  const { error: iErr } = await admin.from("saved_search_events").insert({ company_id: ctx.companyId, owner_id: ctx.userId, search_id: body.id, kind: body.kind });
  if (iErr) {
    console.error(`[saved-search-events] insert failed: ${iErr.message}`);
    return NextResponse.json({ error: "Couldn't update the search." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind: body.kind });
}
