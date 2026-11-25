import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";

/**
 * POST /api/coach/remote/saved-searches/events { id, kind: "follow" | "unfollow" | "seen" } — follow a saved search,
 * stop following it, or mark it opened (0342; Gong ledger F12.7). Only on your own, not-removed search; owner and
 * company from the session; append-only.
 */
const Body = z.object({ id: z.string().uuid(), kind: z.enum(["follow", "unfollow", "seen"]) });

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
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("owner_id", ctx.userId)
    .eq("id", body.id)
    .is("removed_at", null)
    .maybeSingle();
  if (error) {
    console.error(`[saved-search-events] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't update the search." }, { status: 500 });
  }
  if (!s) return NextResponse.json({ error: "Search not found." }, { status: 404 });
  const { error: iErr } = await admin.from("saved_search_events").insert({ company_id: ctx.companyId, owner_id: ctx.userId, search_id: body.id, kind: body.kind });
  if (iErr) {
    console.error(`[saved-search-events] insert failed: ${iErr.message}`);
    return NextResponse.json({ error: "Couldn't update the search." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind: body.kind });
}
