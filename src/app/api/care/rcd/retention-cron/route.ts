import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";

/**
 * GET /api/care/rcd/retention-cron — RCD retention purge (Phase 3b; see docs/feature-specs/RCD-RAW-CONVERSATION-DATA.md).
 *
 * RCD stores CUSTOMER conversation content + media scraped from third-party channels — PII we chose to
 * hold (founder decision 2026-07-26). Holding PII without a retention path is the irresponsible half;
 * this is the responsible complement (§3.4). Deletes care_rcd_conversations older than the retention
 * window (cascade removes their messages + media ROWS), AND removes the media BYTES from the private
 * bucket first — so bytes are never orphaned (the recording-purge-cron discipline: never delete the
 * pointer before the object is gone).
 *
 * The ONLY delete path for RCD (the tables are content-immutable via triggers; app code never deletes).
 *
 * Window: RCD_RETENTION_DAYS (env), default 90. FOUNDER: set this to your actual retention policy for
 * customer PII, then schedule the cron. Auth: CRON_SECRET Bearer (constantTimeEqual), 503 if unset.
 * DORMANT until: 0194 applied + CRON_SECRET set + a vercel.json entry added — nothing purges until then.
 * Bounded batch with an honest `bounded` flag (§3.4) — never a silent "all done".
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "care-rcd-media";
const BATCH = 200;

function retentionDays(): number {
  const parsed = parseInt(process.env.RCD_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set — RCD retention purge disabled until configured." },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const days = retentionDays();
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Oldest-first so a backlog can't starve the oldest expired captures.
  const { data: expired, error } = await admin
    .from("care_rcd_conversations")
    .select("id")
    .lt("captured_at", cutoff)
    .order("captured_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    // Missing table (0194 unapplied) or any read error — nothing to purge; report, don't crash.
    return NextResponse.json({ purged: 0, scanned: 0, note: "no rcd table or read error", retentionDays: days });
  }

  let purged = 0;
  let storageErrors = 0;
  for (const row of expired ?? []) {
    const convId = row.id as string;

    // 1. Collect this conversation's media BYTE paths BEFORE deleting the rows (else the cascade wipes
    //    the pointers and the objects orphan forever).
    const { data: media } = await admin
      .from("care_rcd_media")
      .select("storage_path")
      .eq("conversation_id", convId);
    const paths = (media ?? [])
      .map((m) => m.storage_path as string)
      .filter((p) => typeof p === "string" && p.length > 0);

    // 2. Remove the bytes. "Already gone" is fine (converges); a real storage failure means leave the
    //    row for the next run rather than orphan live bytes.
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
      if (rmErr && !/not found|does not exist/i.test(rmErr.message)) {
        storageErrors += 1;
        continue;
      }
    }

    // 3. Delete the conversation row — cascade removes its messages + media rows.
    const { error: delErr } = await admin.from("care_rcd_conversations").delete().eq("id", convId);
    if (!delErr) purged += 1;
    else storageErrors += 1;
  }

  return NextResponse.json({
    purged,
    storageErrors,
    scanned: expired?.length ?? 0,
    bounded: (expired?.length ?? 0) >= BATCH, // true = more may remain; not a silent "all clear"
    retentionDays: days,
  });
}
