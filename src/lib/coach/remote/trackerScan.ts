import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { matchTracker, trackerAppliesTo, type KeywordTracker, type Segment } from "./trackers";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";

/**
 * The writer of tracker_hits (migration 0276; RSS Phase 3 step 3, Gong F11.1): match the company's active
 * keyword trackers against a remote sales session's CURRENT transcript and store each hit with its time.
 *
 * Called when a transcript lands (generateSessionArtifacts: live finalize, upload labelling, recovery, backfill)
 * and by the tracker route's "scan recent sessions" after a manager creates a tracker. Idempotent: hits are
 * unique per (tracker, session, transcript version, seq, phrase) and written ON CONFLICT DO NOTHING, so any
 * number of scans of one transcript store one set of hits; a repaired transcript (0269) is a new version and is
 * matched afresh.
 *
 * D1: remote sales sessions only (phone/video, session_kind sales). Door sessions and meetings are skipped.
 * Never throws; returns how many hits it wrote, or null when it could not run (logged).
 */
export async function scanSessionTrackers(sessionId: string, client?: SupabaseClient): Promise<number | null> {
  try {
    // Resolved INSIDE the try: a missing service key must not throw into the transcript-landing path.
    const admin = client ?? createAdminClient();
    const { data: s } = await admin
      .from("coaching_sessions")
      .select("id, company_id, agent_id, context, session_kind, started_at, audio_started_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (!s || !isRemoteContext(s.context) || !isSalesCall((s.session_kind as string | null) ?? "sales")) return 0;
    const companyId = String(s.company_id);

    const { data: trackerRows, error: tErr } = await admin
      // 0352: live trackers only — on, and not a draft (the view is the one definition of "live").
      .from("keyword_trackers_live")
      .select("id, name, phrases, side, kind, within_first_seconds, starts_on, ends_on, channels")
      .eq("company_id", companyId);
    if (tErr) {
      console.error(`[trackerScan] trackers read failed company=${companyId}: ${tErr.message}`);
      return null;
    }
    // Smart trackers (0329) are matched by meaning in smartTrackerScan.ts, never as phrases here.
    // Smart trackers are matched elsewhere; a dated tracker (0344) counts only on calls inside its dates.
    const trackers = ((trackerRows ?? []) as Array<KeywordTracker & { kind?: string }>).filter(
      (t) => (t.kind ?? "keyword") !== "smart" && trackerAppliesTo(t, (s.started_at as string | null) ?? null, (s.context as string | null) ?? null),
    );
    if (trackers.length === 0) return 0;

    const { data: segRows, error: sErr } = await admin
      .from("coaching_transcript_segments_current")
      .select("speaker, text, seq, spoken_at, version")
      .eq("session_id", sessionId)
      .order("seq", { ascending: true });
    if (sErr) {
      console.error(`[trackerScan] transcript read failed session=${sessionId}: ${sErr.message}`);
      return null;
    }
    const rows = (segRows ?? []) as Array<{ speaker: string; text: string; seq: number; spoken_at: string | null; version: number }>;
    if (rows.length === 0) return 0;

    const base = audioBaseIso((s.started_at as string | null) ?? null, (s.audio_started_at as string | null) ?? null); // 0300
    const start = base ? Date.parse(base) : NaN;
    const segments: Segment[] = rows.map((r) => {
      const at = r.spoken_at ? Date.parse(r.spoken_at) : NaN;
      return {
        speaker: r.speaker === "agent" ? "rep" : r.speaker === "customer" ? "customer" : "unknown",
        // A time only when both clocks exist and the segment is not before the session began.
        startMs: Number.isFinite(at) && Number.isFinite(start) && at >= start ? at - start : null,
        text: r.text,
        seq: r.seq,
      };
    });
    const version = Math.max(1, Number(rows[0]!.version) || 1);

    const hits = trackers.flatMap((t) => {
      try {
        return matchTracker(t, segments);
      } catch {
        return []; // a tracker that no longer validates matches nothing rather than stopping the others
      }
    });
    if (hits.length === 0) return 0;

    // A plain insert of only the hits not already stored: Postgres refuses ON CONFLICT (even DO NOTHING) on a table
    // with an UPDATE rule (0276:82), and one duplicate in a plain batch insert fails the whole batch.
    const { data: had, error: hadErr } = await admin
      .from("tracker_hits")
      .select("tracker_id, seq, matched")
      .eq("session_id", sessionId)
      .eq("transcript_version", version);
    if (hadErr) {
      console.error(`[trackerScan] hits read failed session=${sessionId}: ${hadErr.message}`);
      return null;
    }
    const key = (t: unknown, seq: unknown, m: unknown) => `${String(t)}|${Number(seq)}|${String(m)}`;
    const stored = new Set(((had ?? []) as Array<{ tracker_id: string; seq: number; matched: string }>).map((r) => key(r.tracker_id, r.seq, r.matched)));
    const fresh = hits.filter((h) => !stored.has(key(h.trackerId, h.seq ?? 0, h.matched)));
    if (fresh.length === 0) return hits.length;

    const { error } = await admin.from("tracker_hits").insert(
      fresh.map((h) => ({
        tracker_id: h.trackerId,
        session_id: sessionId,
        company_id: companyId,
        rep_id: String(s.agent_id),
        seq: h.seq ?? 0,
        at_ms: h.atMs,
        speaker: h.speaker,
        matched: h.matched,
        transcript_version: version,
      }))
    );
    // 23505: a concurrent scan of the same version stored them first, which is the outcome this call wanted.
    if (error && error.code !== "23505") {
      console.error(`[trackerScan] hits write failed session=${sessionId}: ${error.message}`);
      return null;
    }
    return hits.length;
  } catch (err) {
    console.error(`[trackerScan] threw session=${sessionId}:`, err);
    return null;
  }
}
