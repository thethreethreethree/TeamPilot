import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { previewTracker, TrackerError, type PreviewCall, type Segment } from "@/lib/coach/remote/trackers";

/**
 * POST /api/coach/remote/trackers/preview { phrases, side, startsOn?, endsOn? } — try a tracker on the 100 most recent phone/video calls before
 * saving it (Gong F11.4). Managers only, like creating one. Reads through the CALLER's client, so only calls this
 * manager may see are checked (coaching_sessions RLS + the reporting tree). Nothing is stored; no AI is used.
 */
const Body = z.object({
  phrases: z.array(z.string().max(80)).min(1).max(200),
  side: z.enum(["rep", "customer", "any"]),
  withinFirstMinutes: z.number().min(0.5).max(60).nullable().optional(),
  // 0344: preview only the calls the tracker would count (its dates), as the real scan does.
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // 0361: preview only the call types the tracker would listen to.
  channels: z.array(z.enum(["phone", "video"])).min(1).max(2).nullable().optional(),
});
// Gong previews on 100 calls (ledger F11.4); the keyword matcher needs no AI, so 100 is cheap.
const CALLS = 100;
const SESSION_CHUNK = 25;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-tracker-preview", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const manager = await requireSalesCoachManager(req);
  if (!manager) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const db = callerScopedDb(req) ?? (await createClient());
  let sq = db
    .from("coaching_sessions")
    .select("id, client_label, started_at, audio_started_at, session_kind")
    .eq("company_id", manager.companyId)
    .in("context", body.channels?.length ? [...new Set(body.channels)] : [...REMOTE_CONTEXTS])
    .neq("status", "active");
  if (body.startsOn) sq = sq.gte("started_at", `${body.startsOn}T00:00:00Z`);
  if (body.endsOn) sq = sq.lt("started_at", new Date(Date.parse(`${body.endsOn}T00:00:00Z`) + 86_400_000).toISOString());
  const { data: sessions, error } = await sq.order("started_at", { ascending: false }).limit(CALLS);
  if (error) {
    console.error(`[tracker-preview] sessions read failed company=${manager.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read recent calls." }, { status: 500 });
  }
  // Sales calls only — the one verdict (isSalesCall), as the real scan asks it.
  const rows = ((sessions ?? []) as Array<{ id: string; client_label: string | null; started_at: string; audio_started_at: string | null; session_kind: string | null }>).filter(
    (s) => isSalesCall(s.session_kind ?? "sales"),
  );
  if (rows.length === 0) return NextResponse.json({ preview: { callsChecked: 0, callsWithHits: 0, hitCount: 0, perPhrase: [], examples: [] } });

  // In chunks of calls, each paged in a STABLE order (call, then line): ordering by line alone across many calls let
  // pages overlap or skip lines (review 2026-11-26).
  type Seg = { session_id: string; speaker: string; text: string; seq: number; spoken_at: string | null };
  const segs: Seg[] = [];
  for (let i = 0; i < rows.length; i += SESSION_CHUNK) {
    const ids = rows.slice(i, i + SESSION_CHUNK).map((r) => r.id);
    const { data, error: sErr } = await fetchAllPagedResult<Seg>(
      (from, to) =>
        db
          .from("coaching_transcript_segments_current")
          .select("session_id, speaker, text, seq, spoken_at")
          .in("session_id", ids)
          .order("session_id", { ascending: true })
          .order("seq", { ascending: true })
          .range(from, to),
      { label: "tracker preview transcripts", maxRows: 60_000 },
    );
    if (sErr) {
      console.error(`[tracker-preview] transcripts read failed company=${manager.companyId}: ${sErr.message}`);
      return NextResponse.json({ error: "Couldn't read the transcripts." }, { status: 500 });
    }
    segs.push(...(data ?? []));
  }
  const bySession = new Map<string, Array<{ speaker: string; text: string; seq: number; spoken_at: string | null }>>();
  for (const s of segs) {
    const list = bySession.get(s.session_id) ?? [];
    list.push(s);
    bySession.set(s.session_id, list);
  }
  const calls: PreviewCall[] = rows.map((r) => {
    const base = audioBaseIso(r.started_at, r.audio_started_at);
    const start = base ? Date.parse(base) : NaN;
    const segments: Segment[] = (bySession.get(r.id) ?? []).map((s) => {
      const at = s.spoken_at ? Date.parse(s.spoken_at) : NaN;
      return {
        speaker: s.speaker === "agent" ? "rep" : s.speaker === "customer" ? "customer" : "unknown",
        startMs: Number.isFinite(at) && Number.isFinite(start) && at >= start ? at - start : null,
        text: s.text,
        seq: s.seq,
      };
    });
    return { sessionId: r.id, label: r.client_label, startedAt: r.started_at, segments };
  });

  try {
    return NextResponse.json({ preview: previewTracker({ name: "preview", phrases: body.phrases, side: body.side, within_first_seconds: body.withinFirstMinutes != null ? Math.round(body.withinFirstMinutes * 60) : null }, calls) });
  } catch (e) {
    if (e instanceof TrackerError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
