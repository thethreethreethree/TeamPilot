import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSession,
  getSessionTranscript,
  replaceSessionTranscript,
  type TranscriptSpeaker,
  type TranscriptSegment,
} from "@/lib/data/salesCoach";
import { autoAssignAgentCluster } from "./autoSpeakerAssign";
import { spokenAtFor } from "./segmentTiming";
import { downloadAssetBytes, assetUrlToStoragePath } from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { generateSessionArtifacts } from "./generateSessionArtifacts";

/**
 * transcriptRecovery — the resolver for a call whose words never reached the record.
 *
 * THE FAILURE THIS ENDS, stated exactly. A recording could reach the server, be stored,
 * have its true duration stamped from the transcription's own word timestamps, and still
 * leave ZERO transcript rows behind. Nothing failed, nothing said so, and the coach later
 * reported the thread came through empty. Measured on production 10 September 2026: of 16
 * sessions holding saved audio, NINE had no transcript at all — one of them the founder's
 * own 149-second test from that morning — and every one of the nine had
 * `auto_recover_attempted_at = null`. Nothing had ever tried to fix them.
 *
 * WHY nothing tried, which is the part worth keeping. Two recovery directions already
 * existed and neither owned this case:
 *   - `/auto-recover` keys on the talk_ratio CAVEAT (captureGap "customer-missing"): the
 *     agent side was captured and the customer side was not. `computeTalkRatio` of an
 *     EMPTY transcript returns null, so that route answered "not-applicable" and stopped.
 *     Its own comment deferred the empty case to "the whole-empty recovery path".
 *   - that path is captureGap "agent-missing" -> the MANUAL one-tap card on the web
 *     After-Pitch page -> `/label-transcript`. It needs a human to open the call and tap.
 * The nine were recorded on the phone, where no such card exists. So a mobile call that
 * came back blank had no recovery path at all — automatic or manual.
 *
 * THE RULE THIS MODULE ADDS, replacing both special cases with one sentence: a transcript
 * MISSING AN ENTIRE SIDE can still be improved by re-reading the saved audio; a two-sided
 * transcript is canonical and is never touched. That covers blank, unknown-only,
 * customer-only and the original customer-missing gap without asking which of them it is.
 *
 * ATTRIBUTION IS A REFINEMENT, NOT A PRECONDITION (founder decision, 10 September 2026:
 * "save unlabelled, then ask"). When the auto-assignment is confident the words are written
 * with real agent/customer labels and coaching runs with no tap at all. When it is NOT
 * confident the words are STILL written, as `unknown`, and the rep is asked one question
 * later. The coaching engines filter on `speaker === "agent"`, so an unknown transcript
 * scores nothing until it is labelled — but it is readable, searchable, exportable and
 * one tap from complete, where before it did not exist. A saved unknown beats a confident
 * wrong label: a fabricated attribution would put the wrong voice under every score.
 */

/** What a transcript currently holds, reduced to the only thing the decision needs. */
export type TranscriptState = { total: number; agent: number; customer: number };

export function stateOf(segments: Pick<TranscriptSegment, "speaker">[]): TranscriptState {
  let agent = 0;
  let customer = 0;
  for (const s of segments) {
    if (s.speaker === "agent") agent += 1;
    else if (s.speaker === "customer") customer += 1;
  }
  return { total: segments.length, agent, customer };
}

/**
 * Can re-reading the saved audio still add something this transcript does not have?
 *
 * ONE rule for every direction: a missing SIDE is recoverable. Blank (nothing at all),
 * unknown-only (words but no attribution), customer-only, and the customer-missing gap
 * all qualify. A two-sided transcript does not — it is canonical, and re-diarizing would
 * only risk replacing real captured speech with a second opinion.
 */
export function isRecoverable(state: TranscriptState): boolean {
  if (state.total === 0) return true;
  return state.agent === 0 || state.customer === 0;
}

/**
 * May a DECLINED assignment still overwrite what is there?
 *
 * Only when the existing transcript holds no `agent` turn. That is the same precondition
 * `/label-transcript` already enforces, and the reason is the same: an agent turn is real
 * attributed speech that the live path captured, and an unlabelled re-read is worse than
 * it. With no agent turn there is nothing of that kind to lose, so writing `unknown` is
 * strictly better than leaving the call blank.
 */
export function mayOverwriteUnlabelled(state: TranscriptState): boolean {
  return state.agent === 0;
}

/** The label a diarized cluster gets. No assignment means `unknown` — never a guess. */
export function labelFor(speakerId: string, agentSpeakerId: string | null): TranscriptSpeaker {
  if (!agentSpeakerId) return "unknown";
  return speakerId === agentSpeakerId ? "agent" : "customer";
}

/**
 * How many times a TRANSIENT failure may hand the same session back for another try.
 *
 * The marker release exists so a momentary outage does not permanently burn a session's
 * one recovery attempt. Under a rep pressing a button that is obviously right: they try
 * again, or they do not. Under an HOURLY UNATTENDED SWEEP it is a different thing
 * entirely - a recording that can NEVER be transcribed (too large for the function budget,
 * a codec the provider rejects) fails, releases, and is picked up again next hour, forever,
 * costing money every time and never finishing.
 *
 * Measured 10 September 2026, which is why this exists: three of the nine dropped sessions
 * are 39-43 MB, against 619 KB for a known 149-second call. Those are hours of audio, and
 * they are exactly the ones most likely to exceed a 300-second function budget - so the
 * one case with the most to recover is also the one that would have looped.
 *
 * Three attempts absorbs a real outage. The fourth says the failure is not transient after
 * all, and the session keeps its marker so nothing spends on it again until a person asks.
 */
export const MAX_TRANSIENT_RETRIES = 3;

/** Recorded per transient failure, so the retry budget survives a process restart. */
const RETRY_EVENT_KIND = "coach.transcript_recovery_retry";

export type RecoveryResult =
  /** Labelled agent/customer and the coaching artifacts regenerated — nothing to ask. */
  | { status: "recovered"; appended: number; source: "cross-match" | "content-tell" }
  /** Words saved as `unknown`. Safe, readable, and one rep tap from being coachable. */
  | { status: "saved-unlabelled"; appended: number; reason: string }
  /** Two-sided already. Untouched, deliberately. */
  | { status: "canonical" }
  /** One-sided WITH real agent turns, and the assignment declined — original left intact. */
  | { status: "still-one-sided"; reason: string }
  | { status: "no-audio" }
  | { status: "already-attempted" }
  /**
   * `where` carries WHOSE failure it was, because the caller answers differently:
   * "upstream" is the storage download or the speech-to-text provider (a 502 — their
   * outage, ours to retry), "internal" is our own database write (a 500), and "invalid"
   * is a request that can never succeed as posed (a 422). Collapsing these into one code
   * would tell a client that an outage and a corrupt pointer are the same event.
   */
  | {
      status: "failed";
      error: string;
      transient: boolean;
      where: "upstream" | "internal" | "invalid";
    };

/**
 * Recover one session's transcript from its saved audio.
 *
 * Callable from anywhere that can name a session: the on-open route (a rep looking at the
 * call) and the unattended sweep (the calls nobody reopened) run this SAME function, so
 * the two triggers can never drift into two different recovery behaviours.
 *
 * `db` is the client the caller's identity reads through — the cookie/Bearer client for a
 * request, the admin client for the cron. Access is decided by RLS through that client,
 * exactly where it already lives, rather than copied into each caller. WRITES always go
 * through the service role, as they already did.
 */
export async function recoverSessionTranscript(args: {
  sessionId: string;
  companyId: string;
  /** Whose name the regenerated artifacts are recorded under. */
  actorId: string;
  db: SupabaseClient;
}): Promise<RecoveryResult> {
  const { sessionId, companyId, actorId, db } = args;
  const admin = createAdminClient();

  const session = await getSession(sessionId, db);
  if (!session)
    return { status: "failed", error: "Session not found.", transient: false, where: "invalid" };
  if (!session.audioAssetUrl) return { status: "no-audio" };

  const existing = await getSessionTranscript(sessionId, db);
  const state = stateOf(existing);
  if (!isRecoverable(state)) return { status: "canonical" };

  // At-most-once claim (ATOMIC), before any STT cost. A conditional UPDATE takes the row
  // lock, so a reload racing the sweep cannot both win — the loser sees 0 rows and spends
  // nothing.
  const { data: claimed, error: claimErr } = await admin
    .from("coaching_sessions")
    .update({ auto_recover_attempted_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .is("auto_recover_attempted_at", null)
    .select("id");
  if (claimErr) {
    return {
      status: "failed",
      error: "Couldn't start recovery right now.",
      transient: true,
      where: "internal",
    };
  }
  if (!claimed || claimed.length === 0) {
    // Already attempted — do NOT spend speech-to-text again. But if the PRIOR attempt
    // declined because the audio genuinely holds ONE voice, say so: a reload must render
    // the honest terminal, not a generic "already attempted" that offers a re-transcribe
    // card which only reproduces the one voice and dead-ends (2026-08-14 finding 8).
    const { data: declined } = await admin
      .from("events")
      .select("id")
      .eq("kind", "coach.auto_recover_declined")
      .eq("subject", `sales_session:${sessionId}`)
      .limit(1);
    if ((declined?.length ?? 0) > 0) {
      return { status: "still-one-sided", reason: "single-cluster" };
    }
    return { status: "already-attempted" };
  }

  /**
   * Hand this session back for another try - but only while the retry budget lasts.
   *
   * A TRANSIENT infra failure must not permanently burn the automatic path, and a
   * DEFINITIVE outcome keeps the marker set. The third case is the one the sweep created:
   * a failure that PRESENTS as transient every time but can never succeed. Past
   * MAX_TRANSIENT_RETRIES the marker stays set, which stops the loop and leaves the
   * session visible to a person rather than silently spending forever.
   */
  const releaseMarker = async () => {
    const { count, error: countErr } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("kind", RETRY_EVENT_KIND)
      .eq("subject", `sales_session:${sessionId}`);
    // Fail CLOSED on a counting error: not releasing costs one delayed recovery, releasing
    // blindly is the cost loop this budget exists to prevent.
    if (countErr) {
      // eslint-disable-next-line no-console
      console.error(
        `[transcriptRecovery] retry count failed session=${sessionId}: ${countErr.message}`
      );
      return;
    }
    if ((count ?? 0) >= MAX_TRANSIENT_RETRIES) {
      // eslint-disable-next-line no-console
      console.error(
        `[transcriptRecovery] retry budget spent session=${sessionId} — marker kept, no further automatic attempts`
      );
      return;
    }
    try {
      await admin.from("events").insert({
        company_id: companyId,
        actor: actorId,
        kind: RETRY_EVENT_KIND,
        subject: `sales_session:${sessionId}`,
        payload: { attempt: (count ?? 0) + 1, coach_version: "transcript-recovery-v1" },
      });
    } catch {
      /* best-effort: a lost tally costs one extra attempt, not a loop */
    }
    const { error } = await admin
      .from("coaching_sessions")
      .update({ auto_recover_attempted_at: null })
      .eq("id", sessionId)
      .eq("company_id", companyId);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[transcriptRecovery] marker release failed session=${sessionId}: ${error.message}`
      );
    }
  };

  const storagePath = assetUrlToStoragePath(session.audioAssetUrl);
  if (!storagePath) {
    return {
      status: "failed",
      error: "The saved recording pointer isn't recognized.",
      transient: false,
      where: "invalid",
    };
  }
  const dl = await downloadAssetBytes({ storagePath });
  if (!dl.ok || !dl.bytes) {
    await releaseMarker();
    return {
      status: "failed",
      error: "Couldn't read the saved recording right now.",
      transient: true,
      where: "upstream",
    };
  }

  let diarized: { speakerId: string; text: string; seq: number; start: number }[];
  let durationSeconds = 0;
  try {
    const t = await transcribeWithDiarization({
      audio: dl.bytes,
      mimeType: dl.contentType || "audio/webm",
      numSpeakers: 2,
    });
    diarized = t.segments.map((s, i) => ({
      speakerId: s.speakerId,
      text: s.text,
      seq: i,
      start: s.start,
    }));
    durationSeconds = t.durationSeconds;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[transcriptRecovery] diarization failed session=${sessionId}:`, err);
    await releaseMarker();
    return {
      status: "failed",
      error: "Couldn't process the recording right now.",
      transient: true,
      where: "upstream",
    };
  }

  // Silence is the one honest blank. If the audio really carries no words there is nothing
  // to save, and saying so is not the same failure as dropping words that existed.
  if (diarized.every((s) => s.text.trim().length === 0)) {
    return { status: "saved-unlabelled", appended: 0, reason: "no-speech" };
  }

  const knownAgentTurns = existing.filter((s) => s.speaker === "agent").map((s) => s.text);
  const assign = autoAssignAgentCluster({ diarized, knownAgentTurns });

  // DECLINED, and the existing transcript holds real agent speech -> leave it alone. This is
  // the original one-sided doctrine and it still holds: an unlabelled re-read is worse than
  // captured, attributed speech.
  if (!assign.decided && !mayOverwriteUnlabelled(state)) {
    // Persist a genuine single-voice decline so a RELOAD (marker already set) reports the
    // honest terminal rather than the generic already-attempted. Best-effort: the decline
    // returns either way. Not written for ambiguous/no-signal — those CAN be retried by
    // hand, and a persisted decline would wrongly close that door.
    if (assign.reason === "single-cluster") {
      try {
        await admin.from("events").insert({
          company_id: companyId,
          actor: actorId,
          kind: "coach.auto_recover_declined",
          subject: `sales_session:${sessionId}`,
          payload: { reason: "single-cluster", coach_version: "transcript-recovery-v1" },
        });
      } catch {
        /* best-effort — the decline response still returns */
      }
    }
    return { status: "still-one-sided", reason: assign.reason };
  }

  const agentSpeakerId = assign.decided ? assign.agentSpeakerId : null;
  const labeled = diarized.map((seg) => ({
    speaker: labelFor(seg.speakerId, agentSpeakerId),
    text: seg.text,
    seq: seg.seq,
    // The re-read carries word timestamps, so the recovered transcript can be placed on the
    // call's own clock. The route this generalizes dropped them.
    spokenAt: spokenAtFor(session.startedAt, seg.start),
  }));

  const replaced = await replaceSessionTranscript(sessionId, labeled);
  if (!replaced.ok) {
    // The replace is atomic and rolled back, so the original is intact and a retry is
    // legitimate — release the marker rather than burning recovery on a momentary blip.
    await releaseMarker();
    return {
      status: "failed",
      error: "Couldn't re-save this call's transcript.",
      transient: true,
      where: "internal",
    };
  }

  // Best-effort: the transcript is already saved and the recovery does not depend on this.
  if (durationSeconds > 0) {
    const { error: durErr } = await admin
      .from("coaching_sessions")
      .update({ audio_duration_seconds: durationSeconds })
      .eq("id", sessionId)
      .eq("company_id", companyId);
    if (durErr) {
      // eslint-disable-next-line no-console
      console.error(
        `[transcriptRecovery] duration stamp failed session=${sessionId}: ${durErr.message}`
      );
    }
  }

  if (!agentSpeakerId) {
    // Saved, unlabelled, honest. The engines read `agent` turns, so generating artifacts
    // here would manufacture a coaching verdict from speech nobody has attributed —
    // exactly the fabrication the decline exists to avoid. The rep's one tap unlocks it.
    return {
      status: "saved-unlabelled",
      appended: replaced.count,
      reason: assign.decided ? "decided" : assign.reason,
    };
  }

  try {
    const segments = await getSessionTranscript(sessionId, admin);
    await generateSessionArtifacts({ companyId, actorId, sessionId, session, segments });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[transcriptRecovery] artifact generation failed session=${sessionId}:`, err);
  }

  return {
    status: "recovered",
    appended: replaced.count,
    source: assign.decided ? assign.source : "content-tell",
  };
}
