import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getSession,
  getSessionTranscript,
  replaceSessionTranscript,
} from "@/lib/data/salesCoach";
import { computeTalkRatio } from "@/lib/coach/v5/salesScore";
import { autoAssignAgentCluster } from "@/lib/coach/v5/autoSpeakerAssign";
import { downloadAssetBytes, assetUrlToStoragePath } from "@/lib/storage/assets";
import { transcribeWithDiarization } from "@/lib/care/voice/elevenlabs";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";

/**
 * POST /api/coach/sales-session/[id]/auto-recover (Live Sales Coach — AUTOMATIC recovery)
 *
 * The founder-reported 2026-08-14 failure: a real 6-minute call produced a blank After-Pitch because live STT
 * captured the AGENT side but not the CUSTOMER side — a one-sided transcript the review + score engines can't
 * work from (computeTalkRatio's "—" caveat is the precise signal: custW === 0 while agent turns exist). This
 * route recovers such a session WITHOUT a rep tap: it re-diarizes the SAVED audio cleanly offline (no live
 * 700ms constraint, so both voices are recovered), auto-assigns which cluster is the agent, replaces the
 * broken transcript, and regenerates the artifacts.
 *
 * Why not reuse /label-transcript: that route 409s any transcript with an agent turn (treating it as
 * canonical), and this transcript HAS agent turns — so it needs its own overwrite precondition, keyed on the
 * talk_ratio caveat (one-sided), never on mere existence. A two-sided transcript is canonical and never
 * clobbered here either.
 *
 * AT-MOST-ONCE: the auto_recover_attempted_at marker (0211) is claimed ATOMICALLY before any STT cost, so a
 * page reload — or a session whose audio genuinely holds one voice (caveat persists) — can never re-trigger
 * the batch diarization into a cost loop. OWNER-ONLY, matching /label-transcript: this WRITES the canonical
 * transcript via the service role (A18 — a colleague must not inject into another rep's record).
 */

// Batch diarization of a full recording — same budget as /retranscribe (a multi-minute call runs well past a
// minute). Plan tier caps this (Pro honors up to 300s).
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-auto-recover",
    windowMs: 60_000,
    max: 3,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  // OWNER-ONLY (A18). getSession is company-scoped; this route writes the canonical transcript via the
  // service role, so — like /label-transcript — only the session's own rep may trigger it. A manager never
  // needs it (they don't walk the door and scores are stripped for them). This is stricter than /retranscribe
  // (owner-or-manager) precisely because /retranscribe only RETURNS content while this one WRITES it.
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's rep can recover its transcript." },
      { status: 403 }
    );
  }

  // Must have a saved recording to re-transcribe.
  if (!session.audioAssetUrl) {
    return NextResponse.json(
      { status: "no-audio", error: "No saved recording for this session to recover." },
      { status: 409 }
    );
  }

  // ── Precondition (cheap read, BEFORE claiming the marker so a mistaken/healthy call doesn't waste it):
  // only the CUSTOMER-MISSING one-sided transcript is recoverable here. A two-sided transcript is canonical
  // and must never be clobbered; an empty / 0-agent transcript is owned by the whole-empty recovery path. ──
  const existing = await getSessionTranscript(id);
  const talk = computeTalkRatio(existing);
  if (!talk || talk.caveat !== true) {
    const hasAgent = existing.some((s) => s.speaker === "agent");
    // Two-sided (has agent turns, no caveat) = canonical → 409, never touched. Otherwise not our case.
    return NextResponse.json(
      { status: hasAgent ? "canonical" : "not-applicable" },
      { status: hasAgent ? 409 : 200 }
    );
  }

  // ── At-most-once claim (ATOMIC): set the marker only if it's still null. A conditional UPDATE takes the
  // row lock, so two concurrent claims can't both win — the loser sees 0 rows and short-circuits WITHOUT
  // spending STT. This is the cost + re-entrancy guard for reloads and the persistent-caveat still-one-sided
  // case. ──
  const admin = createAdminClient();
  const { data: claimed, error: claimErr } = await admin
    .from("coaching_sessions")
    .update({ auto_recover_attempted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .is("auto_recover_attempted_at", null)
    .select("id");
  if (claimErr) {
    console.error(`[auto-recover] marker claim failed session=${id}: ${claimErr.message}`);
    return NextResponse.json(
      { status: "failed", error: "Couldn't start recovery right now — please try again in a moment." },
      { status: 500 }
    );
  }
  if (!claimed || claimed.length === 0) {
    // Already attempted (or a concurrent claim won) — do NOT spend STT again.
    return NextResponse.json({ status: "already-attempted" });
  }

  // The marker is claimed BEFORE the STT so a concurrent reload can't double-diarize. But a TRANSIENT infra
  // failure (STT/download 502) must not PERMANENTLY burn the automatic path — release the marker on those so
  // the next open retries. A DEFINITIVE outcome (recovered / declined / bad-pointer) keeps it set. (Audit
  // 2026-08-14 finding ④.)
  const releaseMarker = async () => {
    const { error } = await admin
      .from("coaching_sessions")
      .update({ auto_recover_attempted_at: null })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) console.error(`[auto-recover] failed to release marker session=${id}: ${error.message}`);
  };

  // ── Re-diarize the saved audio (same body as /retranscribe). ──
  const storagePath = assetUrlToStoragePath(session.audioAssetUrl);
  if (!storagePath) {
    console.error(
      `[auto-recover] unrecognized audio pointer session=${id}: ${session.audioAssetUrl.slice(0, 80)}`
    );
    return NextResponse.json(
      { status: "failed", error: "The saved recording pointer isn't recognized." },
      { status: 422 }
    );
  }
  const dl = await downloadAssetBytes({ storagePath });
  if (!dl.ok || !dl.bytes) {
    console.error(`[auto-recover] download failed session=${id}: ${dl.error ?? "no bytes"}`);
    await releaseMarker(); // transient — allow a later retry
    return NextResponse.json(
      { status: "failed", audioSaved: true, error: "Couldn't read the saved recording right now." },
      { status: 502 }
    );
  }

  let diarized: { speakerId: string; text: string; seq: number }[];
  let durationSeconds = 0;
  try {
    const t = await transcribeWithDiarization({
      audio: dl.bytes,
      mimeType: dl.contentType || "audio/webm",
      numSpeakers: 2,
    });
    diarized = t.segments.map((s, i) => ({ speakerId: s.speakerId, text: s.text, seq: i }));
    durationSeconds = t.durationSeconds;
  } catch (err) {
    console.error("[auto-recover] diarization failed:", err);
    await releaseMarker(); // transient — allow a later retry
    return NextResponse.json(
      { status: "failed", audioSaved: true, error: "Couldn't process the recording right now." },
      { status: 502 }
    );
  }

  // ── Auto-assign the agent cluster. Cross-match against the turns the live path DID capture as the agent
  // (ground truth in the customer-missing case). DECLINE (no write) rather than save a confident wrong label. ──
  const knownAgentTurns = existing.filter((s) => s.speaker === "agent").map((s) => s.text);
  const assign = autoAssignAgentCluster({ diarized, knownAgentTurns });
  if (!assign.decided) {
    // single-cluster → the audio itself is one-voice (honest terminal). ambiguous/no-signal → the rep can
    // still tap manually. Either way: NO delete, NO append — leave the existing partial transcript intact.
    const status = assign.reason === "single-cluster" ? "still-one-sided" : "could-not-decide";
    return NextResponse.json({ status, reason: assign.reason });
  }

  // Stamp the real audio length (§3.5) — best-effort, the recovery itself doesn't depend on it.
  if (durationSeconds > 0) {
    const { error: durErr } = await admin
      .from("coaching_sessions")
      .update({ audio_duration_seconds: durationSeconds })
      .eq("id", id)
      .eq("company_id", companyId);
    if (durErr)
      console.error(`[auto-recover] failed to stamp audio_duration_seconds session=${id}: ${durErr.message}`);
  }

  // ── Overwrite ATOMICALLY (audit 2026-08-14 finding ①). The re-diarized transcript replaces the broken
  // one-sided one in ONE transaction (replace_session_transcript RPC, 0212): delete-all + insert-new, rolled
  // back together on any failure. A delete-then-append pair could destroy the original — which here holds REAL
  // live-captured agent speech — and then fail the re-insert, leaving it destroyed-and-unreplaced or a locked
  // partial. With the atomic replace, a failed write leaves the original intact and we return "failed", never a
  // false "recovered". ──
  const labeled = diarized.map((seg) => ({
    speaker: (seg.speakerId === assign.agentSpeakerId ? "agent" : "customer") as "agent" | "customer",
    text: seg.text,
    seq: seg.seq,
  }));
  const replaced = await replaceSessionTranscript(id, labeled);
  if (!replaced.ok) {
    return NextResponse.json(
      { status: "failed", error: "Couldn't re-save this call's transcript — your recording is safe, please try again." },
      { status: 500 }
    );
  }
  const appended = replaced.count;

  // Regenerate the artifacts from the now two-sided transcript, via after() so the response returns
  // immediately and the write survives the serverless freeze (bare void would be dropped). Best-effort: the
  // transcript is already saved, and a re-summarize / the backfill cron can still supply a missed generation.
  if (appended > 0) {
    try {
      const actorId = auth.user.id;
      const fullTranscript = await getSessionTranscript(id);
      after(async () => {
        try {
          await generateSessionArtifacts({
            companyId,
            actorId,
            sessionId: id,
            session,
            segments: fullTranscript,
          });
        } catch (err) {
          console.error(`[auto-recover] post-recovery artifact generation failed session=${id}:`, err);
        }
      });
    } catch (err) {
      console.error(`[auto-recover] could not schedule post-recovery generation session=${id}:`, err);
    }
  }

  return NextResponse.json({ status: "recovered", appended, source: assign.source });
}
