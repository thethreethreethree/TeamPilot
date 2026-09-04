import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { removeRecordingAudio } from "@/lib/coach/v5/removeRecordingAudio";
import { fetchAllPaged } from "@/lib/supabase/paginate";

/**
 * GET /api/coach/sales-session/recording-purge-cron — recording retention.
 *
 * RETENTION MODEL (founder 2026-08-26, revised from the old 2-day age rule): keep each rep's most-recent
 * KEEP_PER_REP recordings; purge only the ones OLDER than that per-rep window. The age rule deleted a rep's
 * recordings after 2 days, so a rep who didn't pitch for >2 days had NOTHING for the manager to pull from — the
 * count rule guarantees a rolling window of recent recordings regardless of how long ago they pitched.
 *
 * Deletes the AUDIO asset + nulls audio_asset_url for the purge-eligible sessions (recording_saved = false,
 * beyond the rep's KEEP_PER_REP most-recent). Transcript + scores are KEPT — we drop the recording bytes, not the
 * analytics that feed the skill profile. Saved recordings (rep or manager) are exempt (never candidates).
 *
 * Auth: same CRON_SECRET Bearer pattern as the durability/task-overrun crons (constantTimeEqual).
 * Bounded batch with an honest `bounded` flag (§3.4) — never a silent "all done".
 */

// Keep each rep's N most-recent recordings; purge older ones. Founder-chosen N=20 ("save last 20 recordings").
const KEEP_PER_REP = 20;
// NB: this cron removes bytes SEQUENTIALLY (one storage.remove() per session, for per-row error isolation —
// unlike the RCD cron which batches all removes into one call). So 500 sequential storage round-trips could
// approach the 60s maxDuration under a FULL backlog. Steady-state daily volume is tiny (only sessions that
// aged out that day), so 500 is a drain-a-backlog cap, not the normal load; the `bounded` flag makes an
// incomplete run self-heal on the next tick. If you ever see `bounded:true` persist for days, lower this to
// ~200 (the RCD cron's proven value) rather than raise it — smaller batches drain reliably, big ones truncate.
const BATCH = 500;

// Raise past Vercel's ~10s default so a full batch (500 sessions, each now a recording remove() + a chunk-prefix
// list+remove + a DB update) isn't truncated mid-purge — which under a backlog would retain recordings past the
// 2-day promise. Bumped 60→300 (2026-08-21) because the added per-session chunk cleanup roughly doubles the
// sequential storage work; the `bounded` flag still self-heals a truncated run on the next tick.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set — recording purge disabled until configured." },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Count-based retention: fetch ALL purge-eligible recordings (unsaved, has audio), NEWEST-first, then keep each
  // rep's first KEEP_PER_REP and mark the rest (their older recordings) for purge. fetchAllPaged is cap-safe — the
  // candidate set is only sessions that still HAVE audio (a bounded, self-limiting set once the rule is steady).
  let candidates: Array<{ id: string; company_id: string | null; agent_id: string | null; audio_asset_url: string; created_at: string }>;
  try {
    candidates = await fetchAllPaged(
      (from, to) =>
        admin
          .from("coaching_sessions")
          .select("id, company_id, agent_id, audio_asset_url, created_at")
          .not("audio_asset_url", "is", null)
          .eq("recording_saved", false)
          .order("created_at", { ascending: false })
          .range(from, to),
      { label: "recording-purge-candidates" },
    );
  } catch (e) {
    console.error("[coach/recording-purge-cron] query failed:", e);
    return NextResponse.json({ error: "Purge query failed." }, { status: 500 });
  }

  // Per rep, the first KEEP_PER_REP (newest) stay; everything after is beyond the window → purge. A null agent_id
  // (shouldn't happen) is treated as its own bucket so it's never mixed with a real rep's window.
  const seenPerRep = new Map<string, number>();
  const beyondWindow: typeof candidates = [];
  for (const row of candidates) {
    const key = row.agent_id ?? `__null:${row.id}`;
    const n = (seenPerRep.get(key) ?? 0) + 1;
    seenPerRep.set(key, n);
    if (n > KEEP_PER_REP) beyondWindow.push(row);
  }
  // Purge OLDEST-first (candidates were newest-first, so the tail is oldest) and cap the batch; `bounded` self-heals.
  beyondWindow.reverse();
  const expired = beyondWindow.slice(0, BATCH);

  let purged = 0;
  let assetErrors = 0;
  let malformed = 0;
  for (const row of expired ?? []) {
    /**
     * REMOVAL LIVES IN ONE PLACE NOW.
     *
     * This loop body used to hold the removal inline, including its most dangerous branch: `storage.remove()`
     * on a path that does not exist returns NO error, so a pointer of an unrecognised shape would remove
     * nothing, get its column nulled, and leave the audio alive forever while this run reported that retention
     * had happened. When the manager delete control arrived it needed the identical logic, and copying that
     * branch into a second file was not an option.
     *
     * `removeRecordingAudio` owns it, is unit-tested against a fake storage client, and reports the two
     * outcomes this loop has always distinguished: a pointer we cannot interpret (flag it, touch nothing) and
     * a real storage failure (leave the row for the next run rather than orphan a live asset's pointer).
     */
    const removal = await removeRecordingAudio(admin.storage, {
      audioAssetUrl: row.audio_asset_url as string,
      companyId: row.company_id as string | null,
      sessionId: row.id as string,
    });
    if (!removal.ok) {
      if (removal.reason === "malformed-pointer") malformed += 1;
      else assetErrors += 1;
      continue;
    }

    const { error: updErr } = await admin
      .from("coaching_sessions")
      .update({ audio_asset_url: null })
      .eq("id", row.id as string);
    if (!updErr) purged += 1;
  }

  return NextResponse.json({
    purged,
    assetErrors,
    // Rows whose pointer isn't in the shape this cron understands, so their audio could NOT be verified gone.
    // Non-zero means the retention promise is NOT being kept for those rows — surfaced, never swallowed (§3.4).
    malformed,
    scanned: expired.length,
    candidates: candidates.length, // total recordings with audio (unsaved) considered this run
    beyondWindow: beyondWindow.length, // recordings past the per-rep window (the true purge backlog)
    bounded: beyondWindow.length > BATCH, // true = more beyond-window recordings remain; not a silent "all clear"
    keepPerRep: KEEP_PER_REP,
  });
}
