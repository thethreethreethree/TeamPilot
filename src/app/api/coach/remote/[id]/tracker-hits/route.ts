import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";

/**
 * GET /api/coach/remote/:id/tracker-hits — keyword tracker hits on one session's CURRENT transcript (RSS Phase 3,
 * migration 0276), for the session page's chips ("Competitors · 03:12").
 *
 * Read through the caller's client: tracker_hits' policy is the session's rule (owner, or a manager under the
 * reporting tree), so a caller who may not see the session gets nothing. Hits from an older transcript version
 * are left out — they quote words a repair replaced.
 */
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-tracker-hits", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());

  const { data, error } = await db
    .from("tracker_hits")
    .select("tracker_id, seq, at_ms, speaker, matched, transcript_version, keyword_trackers(name, kind)")
    .eq("session_id", id)
    .order("seq", { ascending: true });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, hits: [] });
    console.error(`[remote/tracker-hits] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load tracker hits." }, { status: 500 });
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const latest = rows.reduce((m, r) => Math.max(m, Number(r.transcript_version) || 0), 0);
  const hits = rows
    .filter((r) => Number(r.transcript_version) === latest)
    .map((r) => ({
      trackerId: String(r.tracker_id),
      name: String((r.keyword_trackers as { name?: string } | null)?.name ?? "Tracker"),
      atMs: r.at_ms == null ? null : Number(r.at_ms),
      speaker: String(r.speaker),
      matched: String(r.matched),
      // Smart (0329): `matched` is the tracker's example the line meant, not words from the call.
      smart: (r.keyword_trackers as { kind?: string } | null)?.kind === "smart",
    }));
  return NextResponse.json({ available: true, hits });
}
