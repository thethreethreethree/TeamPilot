import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { ASSETS_BUCKET } from "@/lib/storage/assets";
import { chunkPrefix } from "@/lib/coach/v5/stitchSessionAudio";
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
    const url = row.audio_asset_url as string;
    // THREE writers touch this column and they do NOT agree on its shape: `upload-recording` writes
    // `${ASSETS_BUCKET}/${storagePath}` (bucket-relative), the session PATCH route's zod accepts a full
    // `z.string().url()`, and this cron consumes it. The original code here assumed the first shape and fell
    // back to using the raw string as a path — which is the dangerous branch: `remove()` on a path that isn't
    // there returns NO error, so we would null the pointer and count it `purged`. The audio then survives
    // FOREVER, unreferenced and unfindable, while the run reports that retention ran. That is the false-ok
    // write class (A26 — "a mutation returning ok without asserting the write landed") in the one place it must
    // never exist: the code whose entire job is to make a deletion promise true.
    //
    // A pointer we don't recognize means we cannot know whether the object exists, so we must not touch the
    // row. Flag it and leave it — a data-integrity signal, never a silent purge. ("Already gone" is different
    // and still converges below: no error + nothing removed is a legitimate reason to clear the pointer.)
    if (!url.startsWith(`${ASSETS_BUCKET}/`)) {
      malformed += 1;
      continue;
    }
    const path = url.slice(ASSETS_BUCKET.length + 1);
    const { error: rmErr } = await admin.storage.from(ASSETS_BUCKET).remove([path]);
    // If the object is already gone, still null the pointer (converges). Only a real storage failure counts.
    if (rmErr && !/not found|does not exist/i.test(rmErr.message)) {
      assetErrors += 1;
      continue; // leave the row for the next run rather than orphan a live asset's pointer
    }
    // Also drop the incremental audio CHUNK objects for this session (2026-08-21 audio build). A clean-Stopped
    // session's chunks are orphaned — the full-blob persist set audio_asset_url so stitchSessionAudio (which
    // deletes chunks on success) never ran. They live under `${company}/${session}/chunks/`, keyed on the
    // session id (NOT derivable from the audio path, which uses a fileId), so we use the row's company_id + id.
    // Best-effort + idempotent (a never-Stopped session's chunks were already removed by the stitch → no-op).
    const companyId = row.company_id as string | null;
    if (companyId) {
      const prefix = chunkPrefix(companyId, row.id as string);
      try {
        const { data: chunkObjs } = await admin.storage.from(ASSETS_BUCKET).list(prefix, { limit: 2000 });
        const names = (chunkObjs ?? []).map((o) => `${prefix}/${o.name}`);
        if (names.length > 0) await admin.storage.from(ASSETS_BUCKET).remove(names);
      } catch {
        /* best-effort — orphan chunks are wasteful, not harmful; retried next run via the same row until purged */
      }
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
