import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { parseListenRange } from "@/lib/coach/remote/feedback";

/**
 * POST /api/coach/remote/:id/listen { fromMs, toMs } — one stretch of this call's recording that the caller played
 * (RSS Phase 4, Gong F16.10; migration 0278). Sent by RemoteCallPanel's player on pause, seek and leaving the page.
 *
 * Recorded for whoever plays it — rep or manager. What counts as "listened" is D8 (NOT DECIDED) and is computed at
 * read time from these ranges, so deciding D8 later loses nothing.
 *
 * The caller's own client must be able to read the session (RLS + the 0273 tree); the listener is stamped from
 * auth, never the body. A missing table is a quiet 204: losing a listen range must never break playback.
 */
const MISSING = new Set(["PGRST205", "42P01"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-listen", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;

  let body: { fromMs?: unknown; toMs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const range = parseListenRange(body.fromMs, body.toMs);
  if (!range) return NextResponse.json({ error: "A listen range needs 0 ≤ from < to (ms)." }, { status: 400 });

  const session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });

  const { error } = await createAdminClient().from("listen_events").insert({
    company_id: session.companyId,
    session_id: id,
    listener_id: ctx.userId,
    rep_id: session.agentId,
    from_ms: range[0],
    to_ms: range[1],
  });
  if (error) {
    if (MISSING.has(String(error.code))) return new NextResponse(null, { status: 204 });
    console.error(`[remote/listen] insert failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't record listening." }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
