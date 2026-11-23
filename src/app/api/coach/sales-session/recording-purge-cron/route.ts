import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { constantTimeEqual } from "@/lib/api/constantTime";
import { removeRecordingAudio } from "@/lib/coach/v5/removeRecordingAudio";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { DEFAULT_RETENTION_DAYS, loadRetention, outsideRetention, ruleFor, TRANSCRIPT_ONLY_GRACE_HOURS } from "@/lib/coach/remote/retention";

/**
 * GET /api/coach/sales-session/recording-purge-cron — recording retention.
 *
 * RETENTION MODEL. D14 DECIDED 2026-11-23 (founder, picker): by default audio older than 90 DAYS is removed, however
 * many calls a rep has; a company that sets "keep the last N per rep" (Settings → Protection, 0284) keeps that instead.
 * History: a 2-day age rule (removed 2026-08-26 because a rep who paused for 2 days had nothing left for a manager to
 * pull from), then each rep's last 20. 90 days keeps a quarter of coaching material even for an occasional rep. The
 * decision is retention.ts's `outsideRetention` — one pure, tested function.
 *
 * Deletes the AUDIO asset + nulls audio_asset_url for sessions outside the window (recording_saved = false).
 * Transcript + scores are KEPT — we drop the recording bytes, not the analytics that feed the skill profile. Saved
 * recordings (rep or manager) are exempt (never candidates).
 *
 * Auth: same CRON_SECRET Bearer pattern as the durability/task-overrun crons (constantTimeEqual).
 * Bounded batch with an honest `bounded` flag (§3.4) — never a silent "all done".
 */

// The window per company: its own "last N per rep" (0284), or DEFAULT_RETENTION_DAYS (90, D14) when it has none.
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

  // FAIL CLOSED: the window decides what gets deleted. If the settings cannot be read, purge nothing this run.
  const retention = await loadRetention(admin);
  if (!retention.ok) {
    console.error("[coach/recording-purge-cron] retention settings unreadable; purging nothing:", retention.error);
    return NextResponse.json({ error: "Retention settings unreadable; nothing purged." }, { status: 500 });
  }

  // Count-based retention: fetch ALL purge-eligible recordings (unsaved, has audio), NEWEST-first, then keep each
  // rep's first KEEP_PER_REP and mark the rest (their older recordings) for purge. fetchAllPaged is cap-safe — the
  // candidate set is only sessions that still HAVE audio (a bounded, self-limiting set once the rule is steady).
  let candidates: Array<{ id: string; company_id: string | null; agent_id: string | null; audio_asset_url: string; created_at: string; status?: string | null; hasTranscript?: boolean; live?: boolean }>;
  try {
    candidates = await fetchAllPaged(
      (from, to) =>
        admin
          .from("coaching_sessions")
          .select("id, company_id, agent_id, audio_asset_url, created_at, status")
          .not("audio_asset_url", "is", null)
          .eq("recording_saved", false)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }) // tie-break: equal timestamps must not repeat or skip across pages
          .range(from, to),
      { label: "recording-purge-candidates" },
    );
  } catch (e) {
    console.error("[coach/recording-purge-cron] query failed:", e);
    return NextResponse.json({ error: "Purge query failed." }, { status: 500 });
  }

  // "Keep transcripts only" (0314): a call past the grace window loses its audio only once its transcript is KNOWN to
  // exist. Checked one call at a time (a head count on the current transcript), so a long transcript can never read as
  // "none"; a failed check leaves hasTranscript unset, which keeps the audio (fail closed).
  const graceCutoff = Date.now() - TRANSCRIPT_ONLY_GRACE_HOURS * 3_600_000;
  let transcriptChecks = 0;
  let transcriptCheckErrors = 0;
  for (const c of candidates) {
    if (ruleFor(retention.settings, c.company_id).kind !== "transcript_only") continue;
    c.live = c.status === "active";
    if (c.live || !(Date.parse(c.created_at) < graceCutoff) || transcriptChecks >= BATCH) continue;
    transcriptChecks += 1;
    const { count, error } = await admin.from("coaching_transcript_segments_current").select("session_id", { count: "exact", head: true }).eq("session_id", c.id);
    if (error) transcriptCheckErrors += 1;
    else c.hasTranscript = (count ?? 0) > 0;
  }

  // Outside the window: older than the company's days (the 90-day default, D14), past its "last N per rep", or — for
  // "transcripts only" — transcribed and a day old.
  // One pure decision in retention.ts, tested there.
  const beyondWindow = outsideRetention(candidates, retention.settings, Date.now());
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
    defaultRetentionDays: DEFAULT_RETENTION_DAYS, // the default (D14); companies with their own setting are counted below
    companiesWithSetting: retention.settings.size,
    transcriptChecks,
    transcriptCheckErrors, // non-zero: those calls kept their audio this run (fail closed), retried next run
    retentionTable: retention.tableMissing ? "not_applied" : "ok",
  });
}
