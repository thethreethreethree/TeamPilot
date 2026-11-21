import { NextRequest, NextResponse, after } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { activeTrims, TrimError, validateTrim, type TrimRow } from "@/lib/coach/remote/trim";

/**
 * /api/coach/remote/:id/trim — cut a section out of a call, or put it back (RSS Phase 8, migration 0284; F9.17).
 *   GET  → { trims: active trims, earliest first } for anyone who can open the call (the player skips them).
 *   POST → managers: { startMs, endMs } trims; { restoreTrimId } restores. Never on their own call, only for a rep
 *          under them (0273 tree), with an audit row.
 * What a trim does: the lines inside it leave coaching_transcript_segments_current for every reader (SQL,
 * rss_line_trimmed), the player skips it, and the AI reads are redone — the current transcript is copied into a new
 * version (copy_transcript_version) and generateSessionArtifacts re-runs on it after the response, as the relabel
 * route does. The audio file is kept, so a trim can be undone.
 * Refused when any transcript line has no time: such a line cannot be placed on the recording, so the words in the
 * section would stay and "trimmed" would be untrue.
 */
const MISSING = new Set(["PGRST205", "42P01", "PGRST202", "42883"]);
const NOT_APPLIED = "Trimming is waiting on database migration 0284.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const maxDuration = 300;

async function loadTrims(db: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data: trims, error } = await db
    .from("recording_trims")
    .select("id, start_ms, end_ms, created_at, trimmed_by")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return { error };
  const ids = ((trims ?? []) as TrimRow[]).map((t) => t.id);
  const { data: restores, error: rErr } = ids.length
    ? await db.from("recording_trim_restores").select("trim_id").in("trim_id", ids)
    : { data: [], error: null };
  if (rErr) return { error: rErr };
  return { active: activeTrims((trims ?? []) as TrimRow[], ((restores ?? []) as Array<{ trim_id: string }>).map((r) => String(r.trim_id))) };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-trim-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  if (!(await getSession(id, db))) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  const r = await loadTrims(db as never, id);
  if ("error" in r && r.error) {
    if (MISSING.has(String(r.error.code))) return NextResponse.json({ trims: [], notReady: NOT_APPLIED });
    console.error(`[trim] read failed session=${id}: ${r.error.message}`);
    return NextResponse.json({ error: "Couldn't load this call's trims." }, { status: 500 });
  }
  return NextResponse.json({ trims: (r as { active: TrimRow[] }).active.map((t) => ({ id: t.id, startMs: t.start_ms, endMs: t.end_ms, at: t.created_at })) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-trim-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  let b: { startMs?: unknown; endMs?: unknown; restoreTrimId?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Opened through the caller's own client: RLS + the 0273 tree decide whether they may see it at all.
  const session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  if (!session || session.companyId !== mgr.companyId) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  if (session.agentId === mgr.userId) return NextResponse.json({ error: "You can't trim your own call. Ask your manager." }, { status: 403 });
  if (!(await treeAllowsRep(req, session.agentId))) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });

  const admin = createAdminClient();
  let audited: { action: "recording.trim" | "recording.trim_restore"; meta: Record<string, unknown> };

  if (b.restoreTrimId !== undefined && (typeof b.restoreTrimId !== "string" || !UUID.test(b.restoreTrimId))) {
    // A malformed id would reach PostgREST as a 22P02 and come back as a 500; it is the caller's mistake (review #7).
    return NextResponse.json({ error: "That trim isn't on this call." }, { status: 400 });
  }
  if (typeof b.restoreTrimId === "string") {
    const { data: trim, error: tErr } = await admin
      .from("recording_trims")
      .select("id, start_ms, end_ms")
      .eq("company_id", mgr.companyId)
      .eq("session_id", id)
      .eq("id", b.restoreTrimId)
      .maybeSingle();
    if (tErr) {
      if (MISSING.has(String(tErr.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
      console.error(`[trim] read failed session=${id}: ${tErr.message}`);
      return NextResponse.json({ error: "Couldn't restore that section." }, { status: 500 });
    }
    if (!trim) return NextResponse.json({ error: "That trim isn't on this call." }, { status: 404 });
    const { error } = await admin.from("recording_trim_restores").insert({ company_id: mgr.companyId, trim_id: trim.id, restored_by: mgr.userId });
    if (error?.code === "23505") return NextResponse.json({ error: "That section was already restored." }, { status: 409 });
    if (error) {
      console.error(`[trim] restore failed session=${id}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't restore that section." }, { status: 500 });
    }
    audited = { action: "recording.trim_restore", meta: { trimId: trim.id, startMs: trim.start_ms, endMs: trim.end_ms } };
  } else {
    const startMs = Number(b.startMs);
    const endMs = Number(b.endMs);
    const sec = conversationDurationSeconds(session.audioDurationSeconds, session.startedAt, session.endedAt);
    try {
      validateTrim(startMs, endMs, sec === null ? null : sec * 1000);
    } catch (e) {
      if (e instanceof TrimError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    const lines = await getSessionTranscript(id, admin);
    if (lines.some((l) => !l.spokenAt)) {
      return NextResponse.json(
        { error: "Some lines of this call's transcript have no time, so a trim can't tell which words to remove." },
        { status: 409 },
      );
    }
    const { data: row, error } = await admin
      .from("recording_trims")
      .insert({ company_id: mgr.companyId, session_id: id, start_ms: startMs, end_ms: endMs, trimmed_by: mgr.userId })
      .select("id")
      .maybeSingle();
    if (error) {
      if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
      console.error(`[trim] insert failed session=${id}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't trim that section." }, { status: 500 });
    }
    audited = { action: "recording.trim", meta: { trimId: row?.id ?? null, startMs, endMs } };
  }

  await recordAudit(admin, { companyId: mgr.companyId, actorId: mgr.userId, action: audited.action, objectType: "coaching_session", objectId: id, meta: audited.meta });

  // Redo the AI reads on the trimmed (or restored) transcript. The trim itself is already in force for every reader;
  // this only refreshes what was computed from the old lines. Best-effort, after the response.
  const { data: version, error: vErr } = await admin.rpc("copy_transcript_version", { p_session_id: id });
  if (vErr) console.error(`[trim] version copy failed session=${id}: ${vErr.message}`);
  else {
    after(async () => {
      try {
        const segments = await getSessionTranscript(id, admin);
        await generateSessionArtifacts({ companyId: mgr.companyId, actorId: mgr.userId, sessionId: id, session, segments });
      } catch (err) {
        console.error(`[trim] reprocess failed session=${id}:`, err);
      }
    });
  }

  const now = await loadTrims(admin, id);
  return NextResponse.json({
    ok: true,
    reprocessing: !vErr && Number(version) > 0,
    trims: "active" in now && now.active ? now.active.map((t) => ({ id: t.id, startMs: t.start_ms, endMs: t.end_ms, at: t.created_at })) : [],
  });
}
