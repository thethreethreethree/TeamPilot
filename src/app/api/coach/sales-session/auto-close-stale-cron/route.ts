import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { stitchSessionAudio } from "@/lib/coach/v5/stitchSessionAudio";

/**
 * GET /api/coach/sales-session/auto-close-stale-cron — end ABANDONED live sessions (2026-08-21 capture-reliability).
 *
 * A coaching session is minutes long, but 166 sessions were stuck status='active' for DAYS/weeks (oldest from
 * July) because ending requires the rep to click Stop → name → submit; a tab-close leaves the session active
 * forever, and nothing server-side ever closed it (capture-health only COUNTS ended sessions, so the stuck-active
 * population was invisible). This closes any session still 'active' older than STALE_HOURS: it stamps
 * status='ended' (the 0070 trigger sets ended_at), so it (a) drops out of the "active" clutter in Session
 * Monitoring and (b) becomes eligible for the backfill-dissects cron if it has a transcript. Only closes clearly-
 * abandoned sessions — a real call never stays active for hours — so it can't cut off live coaching.
 *
 * Auth: the same CRON_SECRET Bearer + constantTimeEqual pattern as the other coach/retention crons. Bounded batch
 * with an honest `bounded` flag (§3.4 — never a silent "all done").
 */

const STALE_HOURS = 6;
const BATCH = 500;
// Stitch the incrementally-uploaded audio chunks for the sessions we close (the never-Stopped population, where
// the on-Stop persist never ran) — capped so the extra download+concat+upload work stays inside maxDuration.
// Steady-state closures/run are few (only sessions crossing the 6h line that hour), so the cap rarely binds.
const STITCH_PER_RUN = 25;

// Raised to 300 (2026-08-21): closing is a single UPDATE, but we now also stitch up to STITCH_PER_RUN sessions'
// audio chunks (download+concat+upload each), which needs more than the old 60s ceiling under a burst.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set — auto-close disabled until configured." },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  // Oldest-first so a backlog drains the longest-stuck sessions first. Bounded so a huge backlog can't truncate
  // mid-run past maxDuration — the `bounded` flag makes an incomplete run self-heal on the next tick.
  const { data: stale, error } = await admin
    .from("coaching_sessions")
    .select("id, company_id")
    .eq("status", "active")
    .lt("started_at", cutoff)
    .order("started_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("[coach/auto-close-stale-cron] query failed:", error.message);
    return NextResponse.json({ error: "Auto-close query failed." }, { status: 500 });
  }

  const ids = (stale ?? []).map((r) => r.id as string);
  const companyById = new Map((stale ?? []).map((r) => [r.id as string, r.company_id as string | null]));
  let closed = 0;
  let stitched = 0;
  if (ids.length > 0) {
    // Single UPDATE over the batch (the 0070 active→ended trigger stamps ended_at). Re-scope the WHERE to
    // status='active' so a session ended by another path between the read and write is not double-closed.
    const { data: updated, error: upErr } = await admin
      .from("coaching_sessions")
      .update({ status: "ended" })
      .in("id", ids)
      .eq("status", "active")
      .select("id");
    if (upErr) {
      console.error("[coach/auto-close-stale-cron] update failed:", upErr.message);
      return NextResponse.json({ error: "Auto-close update failed." }, { status: 500 });
    }
    closed = updated?.length ?? 0;

    // "Never lose the recording" (founder 2026-08-21): these sessions were never cleanly Stopped, so the
    // on-Stop persist never ran — stitch their incrementally-uploaded audio chunks into the final recording.
    // Idempotent + no-op (a cheap storage list) for pre-feature sessions with no chunks. Capped per run.
    for (const row of (updated ?? []).slice(0, STITCH_PER_RUN)) {
      const companyId = companyById.get(row.id as string);
      if (!companyId) continue;
      try {
        const r = await stitchSessionAudio({ companyId, sessionId: row.id as string });
        if (r.stitched) stitched += 1;
      } catch (e) {
        console.error(`[coach/auto-close-stale-cron] stitch failed session=${row.id}:`, e);
      }
    }
  }

  return NextResponse.json({ closed, stitched, staleHours: STALE_HOURS, bounded: ids.length === BATCH });
}
