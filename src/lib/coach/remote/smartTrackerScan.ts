import "server-only";
import { trackerAppliesTo } from "@/lib/coach/remote/trackers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { smartTrackerCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { inWindow } from "./trackers";
import { MAX_SMART_TRACKERS, parseSmartHits, smartPrompt, SMART_SYSTEM, type Line, type SmartTracker } from "./smartTrackers";

/**
 * The writer of SMART tracker hits (0329; founder picker "One AI read per call"). Called where keyword trackers are
 * (generateSessionArtifacts — a transcript landing, a relabel, a trim, a notes refresh) and by a new smart tracker's
 * backfill (`onlyTrackerId`: that tracker alone, so a backfill never re-reads — or re-bills — the others). Remote sales calls only, like keyword trackers. With no active smart tracker it makes no AI call. One AI
 * read per call covers every smart tracker. Hits go into tracker_hits at the transcript's current version with
 * `matched` = the example (never the customer's words). Never throws; returns hits written, or null when it couldn't run.
 */
export async function scanSmartTrackers(sessionId: string, client?: SupabaseClient, opts: { onlyTrackerId?: string } = {}): Promise<number | null> {
  try {
    const admin = client ?? createAdminClient();
    const { data: s } = await admin.from("coaching_sessions").select("id, company_id, agent_id, context, session_kind, started_at, audio_started_at").eq("id", sessionId).maybeSingle();
    if (!s || !isRemoteContext(s.context) || !isSalesCall((s.session_kind as string | null) ?? "sales")) return 0;
    const companyId = String(s.company_id);
    let tq = admin.from("keyword_trackers").select("id, name, phrases, side, kind, within_first_seconds, starts_on, ends_on").eq("company_id", companyId).eq("active", true).eq("kind", "smart");
    if (opts.onlyTrackerId) tq = tq.eq("id", opts.onlyTrackerId);
    // The route caps active smart trackers at MAX_SMART_TRACKERS; oldest first so an over-cap race drops the newest.
    const { data: tr, error: tErr } = await tq.order("created_at", { ascending: true }).limit(MAX_SMART_TRACKERS);
    if (tErr) {
      console.error(`[smartTrackerScan] trackers read failed company=${companyId}: ${tErr.message}`);
      return null;
    }
    // A dated tracker (0344) counts only on calls inside its dates — filtered before any AI call is made.
    const trackers: SmartTracker[] = ((tr ?? []) as Array<{ id: string; name: string; phrases: string[]; side: SmartTracker["side"]; within_first_seconds?: number | null; starts_on?: string | null; ends_on?: string | null }>)
      .filter((t) => trackerAppliesTo(t, (s.started_at as string | null) ?? null))
      .map((t) => ({
      id: String(t.id),
      name: t.name,
      examples: t.phrases,
      side: t.side,
      withinFirstSeconds: t.within_first_seconds ?? null,
    }));
    if (trackers.length === 0) return 0; // nothing to look for: no AI call

    const { data: segs, error: sErr } = await admin.from("coaching_transcript_segments_current").select("speaker, text, seq, spoken_at, version").eq("session_id", sessionId).order("seq", { ascending: true });
    if (sErr) {
      console.error(`[smartTrackerScan] transcript read failed session=${sessionId}: ${sErr.message}`);
      return null;
    }
    const rows = (segs ?? []) as Array<{ speaker: string; text: string; seq: number; spoken_at: string | null; version: number }>;
    if (rows.length === 0) return 0;
    // The moment, exactly as trackerScan works it out, so a smart hit's chip seeks like a keyword hit's.
    const base = audioBaseIso((s.started_at as string | null) ?? null, (s.audio_started_at as string | null) ?? null);
    const start = base ? Date.parse(base) : NaN;
    const atMsBySeq = new Map(rows.map((r) => {
      const at = r.spoken_at ? Date.parse(r.spoken_at) : NaN;
      return [r.seq, Number.isFinite(at) && Number.isFinite(start) && at >= start ? at - start : null] as const;
    }));
    const version = Math.max(1, Number(rows[0]!.version) || 1);
    const lines: Line[] = rows.map((r) => ({ seq: r.seq, speaker: r.speaker === "agent" ? "rep" : r.speaker === "customer" ? "customer" : "unknown", text: r.text.slice(0, 600) }));

    const r = await smartTrackerCoach({ companyId, systemPrompt: SMART_SYSTEM + CONVERSATION_IS_DATA, userMessage: smartPrompt(trackers, lines), sessionId });
    if (r.suppressed) return 0;
    const hits = parseSmartHits(r.text, trackers, lines);
    if (!hits) {
      console.error(`[smartTrackerScan] unreadable answer session=${sessionId}`);
      return null;
    }
    // 0335: a windowed tracker keeps only hits inside its first N seconds (an untimed line can't be placed — left out).
    const windowOf = new Map(trackers.map((t) => [t.id, t.withinFirstSeconds ?? null]));
    const inside = hits.filter((h) => inWindow(windowOf.get(h.trackerId), atMsBySeq.get(h.seq) ?? null));
    if (inside.length === 0) return 0;
    return await writeHits(admin, { sessionId, companyId, repId: String(s.agent_id), version }, inside.map((h) => ({ trackerId: h.trackerId, seq: h.seq, atMs: atMsBySeq.get(h.seq) ?? null, speaker: h.speaker, matched: h.example })));
  } catch (err) {
    console.error(`[smartTrackerScan] failed session=${sessionId}:`, err);
    return null;
  }
}

type Hit = { trackerId: string; seq: number; atMs: number | null; speaker: string; matched: string };
async function writeHits(admin: SupabaseClient, at: { sessionId: string; companyId: string; repId: string; version: number }, hits: Hit[]): Promise<number | null> {
  // Same as trackerScan: insert only hits not already stored (tracker_hits has an UPDATE rule, so no ON CONFLICT).
  const { data: had, error } = await admin.from("tracker_hits").select("tracker_id, seq, matched").eq("session_id", at.sessionId).eq("transcript_version", at.version);
  if (error) return null;
  const key = (t: unknown, seq: unknown, m: unknown) => `${String(t)}|${Number(seq)}|${String(m)}`;
  const stored = new Set(((had ?? []) as Array<{ tracker_id: string; seq: number; matched: string }>).map((h) => key(h.tracker_id, h.seq, h.matched)));
  const fresh = hits.filter((h) => !stored.has(key(h.trackerId, h.seq, h.matched)));
  if (fresh.length === 0) return 0;
  const { error: iErr } = await admin.from("tracker_hits").insert(
    fresh.map((h) => ({ tracker_id: h.trackerId, session_id: at.sessionId, company_id: at.companyId, rep_id: at.repId, seq: h.seq, at_ms: h.atMs, speaker: h.speaker === "rep" || h.speaker === "customer" ? h.speaker : "unknown", matched: h.matched, transcript_version: at.version })),
  );
  if (iErr && iErr.code !== "23505") {
    console.error(`[smartTrackerScan] hits insert failed session=${at.sessionId}: ${iErr.message}`);
    return null;
  }
  return fresh.length;
}

/**
 * A word correction (0311) or speaker change (0328) makes a new transcript version. Readers show the latest version's
 * hits, so the smart hits on untouched lines are carried forward to it — no AI call; the edited line's are dropped
 * (its meaning may have changed; the next notes refresh reads it again).
 */
export async function carrySmartHits(sessionId: string, toVersion: number, editedSeq: number, client?: SupabaseClient): Promise<void> {
  try {
    const admin = client ?? createAdminClient();
    const { data: prev } = await admin
      .from("tracker_hits")
      .select("tracker_id, company_id, rep_id, seq, at_ms, speaker, matched, transcript_version, keyword_trackers!inner(kind)")
      .eq("session_id", sessionId)
      .eq("transcript_version", toVersion - 1)
      .eq("keyword_trackers.kind", "smart");
    const rows = ((prev ?? []) as Array<{ tracker_id: string; company_id: string; rep_id: string; seq: number; at_ms: number | null; speaker: string; matched: string }>).filter((h) => h.seq !== editedSeq);
    if (!rows.length) return;
    await writeHits(admin, { sessionId, companyId: rows[0]!.company_id, repId: rows[0]!.rep_id, version: toVersion }, rows.map((h) => ({ trackerId: h.tracker_id, seq: h.seq, atMs: h.at_ms == null ? null : Number(h.at_ms), speaker: h.speaker, matched: h.matched })));
  } catch (err) {
    console.error(`[smartTrackerScan] carry-forward failed session=${sessionId}:`, err);
  }
}
