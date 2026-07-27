import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { ASSETS_BUCKET } from "@/lib/storage/assets";

/**
 * GET /api/coach/sales-session/recording-purge-cron — ELOSALES retention (PDF Sessions item 1b):
 * "deletes the recordings after 2 days (unless saved by the manager or user)."
 *
 * Deletes the AUDIO asset + nulls audio_asset_url for coaching_sessions whose recording is older than
 * RETENTION_DAYS AND recording_saved = false. Transcript + scores are KEPT — the PDF deletes the recording,
 * not the analytics that feed the skill profile. Saved recordings (rep or manager) are exempt.
 *
 * Auth: same CRON_SECRET Bearer pattern as the durability/task-overrun crons (constantTimeEqual).
 * DORMANT until: 0187 applied + CRON_SECRET set + a vercel.json entry added AFTER 0187 lands (else it errors
 * on the missing recording_saved column — same sequencing discipline as the finance deliver-cron).
 * Bounded batch with an honest `bounded` flag (§3.4) — never a silent "all done".
 */

const RETENTION_DAYS = 2;
const BATCH = 500;

// Raise past Vercel's ~10s default so a full batch (500 sessions, each a storage remove() + a DB update)
// isn't truncated mid-purge — which under a backlog would retain recordings past the 2-day promise. Matches
// the RCD retention cron + the durability/task-overrun sweep crons (all maxDuration=60). This one lacked it
// despite having the LARGEST batch, so it was the most truncation-prone of them.
export const maxDuration = 60;

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
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Oldest-first so a backlog can't starve the oldest expired recordings (mirrors the durability sweep).
  const { data: expired, error } = await admin
    .from("coaching_sessions")
    .select("id, audio_asset_url")
    .not("audio_asset_url", "is", null)
    .eq("recording_saved", false)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
    scanned: expired?.length ?? 0,
    bounded: (expired?.length ?? 0) >= BATCH, // true = more may remain; not a silent "all clear"
    retentionDays: RETENTION_DAYS,
  });
}
