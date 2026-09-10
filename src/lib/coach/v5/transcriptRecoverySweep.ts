import { createAdminClient } from "@/lib/supabase/admin";
import { recoverSessionTranscript, stateOf, isRecoverable } from "./transcriptRecovery";

/**
 * transcriptRecoverySweep — the unattended half of transcript recovery.
 *
 * The on-open trigger only ever reaches calls somebody reopens. The nine dropped sessions
 * measured on production 10 September 2026 had sat for up to six weeks precisely because
 * nobody went back to them, and a rep has no reason to reopen a call that showed nothing.
 * So the sweep is not a convenience — without it the "no recording with speech is left
 * without a transcript" rule only holds for calls that happen to be revisited.
 *
 * OLDEST FIRST, and that ordering is load-bearing. `recording-purge-cron` keeps each rep's
 * 20 most recent recordings and deletes the bytes of the rest. A dropped call is therefore
 * on a clock: once its audio is purged the words are unrecoverable forever, because the
 * only copy of them was in audio nobody transcribed. Draining oldest-first spends the
 * budget on the ones closest to that edge.
 *
 * CAPPED per run (§5). Every recovery costs one speech-to-text charge, so an uncapped
 * sweep across every company could turn a backlog into one large unplanned bill. The cap
 * bounds each run and a backlog drains over several — the same shape the dissect backfill
 * uses, for the same reason.
 *
 * SAFE TO RUN REPEATEDLY. `recoverSessionTranscript` claims `auto_recover_attempted_at`
 * atomically before spending anything, so a session is attempted at most once even if the
 * sweep and a rep opening the call collide. A transient infra failure releases the marker
 * and is picked up on a later tick; a definitive outcome keeps it and is never retried.
 */

/**
 * The migration that lets a recovered transcript keep its timing.
 *
 * `replace_session_transcript` carries `spokenAt` only from 0249; the 0212 version selects
 * a literal null. Both succeed, so a sweep running ahead of the migration recovers the
 * words perfectly and drops the timing — and because the at-most-once marker is then set,
 * getting that timing back means clearing markers and paying for transcription twice.
 *
 * On 10 September 2026 exactly that happened: the first sweep recovered a 42-minute call
 * with 106 segments and every `spoken_at` null, because production's ledger ended at 0248.
 * The founder's decision was "apply 0249 first, THEN sweep", so this makes that decision
 * hold rather than depending on a person beating an hourly cron.
 *
 * ONLY THE UNATTENDED SWEEP WAITS. A rep opening a call and triggering recovery is a human
 * choosing to have their words back now; that path is untouched.
 */
const TIMING_MIGRATION = "0249";

/**
 * Has the timing migration been applied?
 *
 * Reads the project's own migration ledger. Returns null when the question cannot be
 * answered — the caller then does NOT sweep, because spending money on an irreversible
 * write while unsure is worse than waiting an hour.
 */
async function timingMigrationApplied(
  admin: ReturnType<typeof createAdminClient>
): Promise<boolean | null> {
  const { data, error } = await admin
    .from("_agent_migrations")
    .select("name")
    .like("name", `${TIMING_MIGRATION}%`)
    .limit(1);
  if (error) return null;
  return (data?.length ?? 0) > 0;
}

export type SweepResult = {
  scanned: number;
  attempted: number;
  recovered: number;
  savedUnlabelled: number;
  skipped: number;
  failed: number;
  /** true when the cap stopped this run short — the rest drains on the next tick (§3.4). */
  bounded: boolean;
  /**
   * Set when the run did nothing because the timing migration is not applied yet.
   *
   * Named rather than reported as an ordinary empty run, so "nothing happened" can never
   * be mistaken for "nothing needed doing" (§3.4).
   */
  waitingForMigration?: string;
};

/** How many candidate sessions to read per run. Cheap: one row each, no audio touched. */
const SCAN_LIMIT = 200;

export async function runTranscriptRecoverySweep(args: {
  /** null = every company. A company id restricts the sweep to that tenant. */
  companyId: string | null;
  cap: number;
}): Promise<SweepResult> {
  const admin = createAdminClient();
  const out: SweepResult = {
    scanned: 0,
    attempted: 0,
    recovered: 0,
    savedUnlabelled: 0,
    skipped: 0,
    failed: 0,
    bounded: false,
  };

  const timingReady = await timingMigrationApplied(admin);
  if (timingReady !== true) {
    out.waitingForMigration = TIMING_MIGRATION;
    // eslint-disable-next-line no-console
    console.error(
      timingReady === null
        ? `[transcriptRecoverySweep] could not read the migration ledger — not sweeping (would risk recovering without timing)`
        : `[transcriptRecoverySweep] migration ${TIMING_MIGRATION} is not applied — not sweeping; recovered transcripts would permanently lose spoken_at`
    );
    return out;
  }

  // Candidates: saved audio, never attempted. Both conditions are indexed columns on the
  // session row, so this stays cheap however large the table gets.
  let q = admin
    .from("coaching_sessions")
    .select("id, company_id, agent_id")
    .not("audio_asset_url", "is", null)
    .is("auto_recover_attempted_at", null)
    .order("started_at", { ascending: true }) // oldest first — closest to the purge edge
    .limit(SCAN_LIMIT);
  if (args.companyId) q = q.eq("company_id", args.companyId);

  const { data: rows, error } = await q;
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[transcriptRecoverySweep] candidate query failed: ${error.message}`);
    return out;
  }

  for (const row of rows ?? []) {
    if (out.attempted >= args.cap) {
      out.bounded = true;
      break;
    }
    out.scanned += 1;
    const companyId = row.company_id as string | null;
    const agentId = row.agent_id as string | null;
    if (!companyId || !agentId) {
      out.skipped += 1;
      continue;
    }

    // A CHEAP pre-check before committing to a recovery. Most sessions with audio already
    // hold a healthy two-sided transcript; reading their segments costs one query, where
    // entering the recovery would claim the marker and burn the one attempt this session
    // will ever get on a call that needed nothing.
    const { data: segs, error: segErr } = await admin
      .from("coaching_transcript_segments")
      .select("speaker")
      .eq("session_id", row.id);
    if (segErr) {
      out.failed += 1;
      continue;
    }
    if (!isRecoverable(stateOf((segs ?? []) as { speaker: "agent" | "customer" | "unknown" }[]))) {
      out.skipped += 1;
      continue;
    }

    out.attempted += 1;
    try {
      // The rep is the actor: these artifacts belong to their call, and the sweep is
      // machinery acting on their behalf rather than a person of its own.
      const result = await recoverSessionTranscript({
        sessionId: row.id as string,
        companyId,
        actorId: agentId,
        db: admin,
      });
      if (result.status === "recovered") out.recovered += 1;
      else if (result.status === "saved-unlabelled") out.savedUnlabelled += 1;
      else if (result.status === "failed") out.failed += 1;
      else out.skipped += 1;
    } catch (err) {
      // One bad session must never end the run — the rest of the backlog is still drainable.
      out.failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[transcriptRecoverySweep] session=${row.id} threw:`, err);
    }
  }

  // A full scan page that we could not finish is also bounded — say so rather than imply
  // the backlog is clear.
  if (!out.bounded && (rows?.length ?? 0) >= SCAN_LIMIT) out.bounded = true;

  return out;
}
