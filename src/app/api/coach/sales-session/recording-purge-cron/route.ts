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
  for (const row of expired ?? []) {
    const url = row.audio_asset_url as string;
    // audio_asset_url is stored as `${ASSETS_BUCKET}/${storagePath}`; strip the bucket prefix.
    const path = url.startsWith(`${ASSETS_BUCKET}/`) ? url.slice(ASSETS_BUCKET.length + 1) : url;
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
    scanned: expired?.length ?? 0,
    bounded: (expired?.length ?? 0) >= BATCH, // true = more may remain; not a silent "all clear"
    retentionDays: RETENTION_DAYS,
  });
}
