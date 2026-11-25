import { NextRequest, NextResponse, after } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { scanCallForHidePhrases } from "@/lib/coach/remote/hidePhrases";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { scanSessionTrackers } from "@/lib/coach/remote/trackerScan";
import { carrySmartHits } from "@/lib/coach/remote/smartTrackerScan";
import { storeInteractionStats } from "@/lib/coach/remote/interactionStats";
import { cleanLine, editMarks, type EditRow } from "@/lib/coach/transcriptEdits";
import { transcriptTextForStorage } from "@/lib/coach/remote/redact";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";

/**
 * /api/coach/sales-session/:id/transcript-edit — correct a line of a call's transcript (2026-11-23; migration 0311;
 * founder picker: the call's rep and their managers).
 *   GET  → { canEdit, edits: [{ seq, original, editedAt, editedByName, count }] } — the "edited" marks.
 *   POST { seq, text } → a new transcript version with that one line corrected (edit_transcript_line); the original
 *        stays in the earlier version. Audit-logged. The deterministic reads (keyword trackers, talk stats) are redone
 *        after the response; the AI-written summary and review are NOT (five paid calls per edit) — the page says so
 *        and offers its existing regenerate.
 * Who: the call's rep, or a manager whose reporting tree includes the rep (0273). Never while the call is live.
 */
export const maxDuration = 300;

const MISSING = new Set(["PGRST205", "42P01", "PGRST202", "42883"]);
const NOT_READY = "Transcript corrections are waiting on database migration 0311.";

async function access(req: NextRequest, id: string) {
  const ctx = await resolveApiAuth(req);
  if (!ctx) return { ok: false as const, status: 401 as const };
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session || session.companyId !== ctx.companyId) return { ok: false as const, status: 404 as const };
  const own = session.agentId === ctx.userId;
  const canEdit = own || (!!(await requireSalesCoachManager(req)) && (await treeAllowsRep(req, session.agentId)));
  return { ok: true as const, ctx, db, session, canEdit };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "transcript-edit-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const { id } = await params;
  const a = await access(req, id);
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Not authenticated." : "Session not found or not accessible." }, { status: a.status });
  const { data: edits, error } = await a.db.from("transcript_line_edits").select("seq, from_version, to_version, edited_by, created_at").eq("session_id", id).order("id", { ascending: true }).limit(1000);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ canEdit: false, edits: [], notReady: NOT_READY });
    console.error(`[transcript-edit] edits read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the transcript corrections." }, { status: 500 });
  }
  const rows = (edits ?? []) as EditRow[];
  const canEdit = a.canEdit && a.session.status !== "active";
  if (!rows.length) return NextResponse.json({ canEdit, edits: [] });
  // The newest edit of any kind — a speaker change (0328) has no "edited" words mark but still dates the AI notes.
  const latestEditAt = rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), "");

  // The words before and after each correction, read through the caller's client (the base table's RLS keeps
  // trimmed lines hidden, 0295), and the current transcript.
  const seqs = [...new Set(rows.map((r) => r.seq))];
  const versions = [...new Set(rows.flatMap((r) => [r.from_version, r.to_version]))];
  const [{ data: lines, error: lErr }, current] = await Promise.all([
    a.db.from("coaching_transcript_segments").select("version, seq, text").eq("session_id", id).in("seq", seqs).in("version", versions).limit(1000),
    getSessionTranscript(id, a.db).catch(() => null),
  ]);
  if (lErr || !current) {
    console.error(`[transcript-edit] lines read failed session=${id}: ${lErr?.message ?? "current transcript"}`);
    return NextResponse.json({ error: "Couldn't load the transcript corrections." }, { status: 500 });
  }
  const at = new Map(((lines ?? []) as Array<{ version: number; seq: number; text: string }>).map((l) => [`${l.version}:${l.seq}`, l.text]));
  const marks = editMarks(rows, (v, s) => at.get(`${v}:${s}`), new Map(current.map((s) => [s.seq, s.text])));
  const editorIds = [...new Set(marks.map((m) => m.editedBy))];
  const { data: people } = editorIds.length
    ? await a.db.from("profiles").select("id, full_name").in("id", editorIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const nameOf = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));
  // When the AI notes were last built (2026-11-23): the newest "generated" event of the summary, moments, pivot or intel.
  // The editor compares it with the latest correction to say the notes are older; null = unknown (button stays offered).
  // Only a sales call has AI notes (salesOnly.ts): a meeting or huddle is never offered a refresh.
  const aiNotes = isSalesCall(a.session.sessionKind);
  const { data: built } = !aiNotes ? { data: [] } : await a.db
    .from("events")
    .select("created_at")
    .eq("subject", `sales_session:${id}`)
    .in("kind", ["coach.session_summary_generated", "coach.session_moments_generated", "coach.session_pivot_generated", "coach.session_intel_generated"])
    .order("created_at", { ascending: false })
    .limit(1);
  const notesBuiltAt = ((built ?? []) as Array<{ created_at: string }>)[0]?.created_at ?? null;
  return NextResponse.json({
    canEdit,
    latestEditAt,
    aiNotes,
    notesBuiltAt,
    edits: marks.map((m) => ({ seq: m.seq, original: m.original, editedAt: m.editedAt, editedByName: nameOf.get(m.editedBy) ?? null, count: m.count })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "transcript-edit-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const { id } = await params;
  const a = await access(req, id);
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Not authenticated." : "Session not found or not accessible." }, { status: a.status });
  if (!a.canEdit) return NextResponse.json({ error: "Only the rep on this call, or their manager, can correct its transcript." }, { status: 403 });
  if (a.session.status === "active") return NextResponse.json({ error: "This call is still live. Correct the transcript once it has ended." }, { status: 409 });
  let b: { seq?: unknown; text?: unknown; speaker?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const seq = Number(b.seq);
  // Who said the line (0328): { seq, speaker: "agent" | "customer" } instead of new words.
  if (b.speaker !== undefined) {
    if (!Number.isInteger(seq) || (b.speaker !== "agent" && b.speaker !== "customer")) return NextResponse.json({ error: "Name the line and who said it (the rep or the customer)." }, { status: 400 });
    const admin = createAdminClient();
    const { data: version, error } = await admin.rpc("edit_transcript_speaker", { p_session_id: id, p_seq: seq, p_speaker: b.speaker, p_editor: a.ctx.userId });
    if (error) {
      if (MISSING.has(String(error.code))) return NextResponse.json({ error: "Speaker corrections are waiting on database migration 0328." }, { status: 503 });
      if (String(error.code) === "P0002") return NextResponse.json({ error: "That line isn't in this call's transcript." }, { status: 404 });
      console.error(`[transcript-edit] speaker edit failed session=${id}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't save the change. Try again." }, { status: 500 });
    }
    await recordAudit(admin, { companyId: a.ctx.companyId, actorId: a.ctx.userId, action: "transcript.edit", objectType: "coaching_session", objectId: id, meta: { seq, version, field: "speaker" } });
    after(async () => {
      await scanSessionTrackers(id, admin);
      await scanCallForHidePhrases(admin, id); // 0337: a corrected line can contain a hide phrase
      await storeInteractionStats(id, admin);
      if (typeof version === "number") await carrySmartHits(id, version, seq, admin);
    });
    return NextResponse.json({ ok: true, changed: true, version });
  }
  // A corrected line is stored under the same number redaction as every transcript line (D15).
  const cleaned = cleanLine(b.text);
  const text = cleaned === null ? null : transcriptTextForStorage(cleaned);
  if (!Number.isInteger(seq) || !text) return NextResponse.json({ error: "Name the line and its corrected words (1-4000 characters)." }, { status: 400 });

  // The line must be one the editor can see now (current version, not inside a trim).
  let current;
  try {
    current = await getSessionTranscript(id, a.db);
  } catch {
    return NextResponse.json({ error: "Couldn't read the transcript. Try again." }, { status: 500 });
  }
  const line = current.find((s) => s.seq === seq);
  if (!line) return NextResponse.json({ error: "That line isn't in this call's transcript." }, { status: 404 });
  if (line.text === text) return NextResponse.json({ ok: true, changed: false });

  const admin = createAdminClient();
  const { data: version, error } = await admin.rpc("edit_transcript_line", { p_session_id: id, p_seq: seq, p_text: text, p_editor: a.ctx.userId });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[transcript-edit] edit failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the correction. Try again." }, { status: 500 });
  }
  await recordAudit(admin, { companyId: a.ctx.companyId, actorId: a.ctx.userId, action: "transcript.edit", objectType: "coaching_session", objectId: id, meta: { seq, version } });
  // The free, deterministic reads follow the corrected words; both never throw.
  after(async () => {
    await scanSessionTrackers(id, admin);
      await scanCallForHidePhrases(admin, id); // 0337: a corrected line can contain a hide phrase
    await storeInteractionStats(id, admin);
    // Smart-tracker hits on the untouched lines follow the new version (no AI call; 0329).
    if (typeof version === "number") await carrySmartHits(id, version, seq, admin);
  });
  return NextResponse.json({ ok: true, changed: true, version });
}

/**
 * PUT — "Refresh AI notes with corrections" (2026-11-23; OPEN.md "transcript corrections do not redo the AI summary,
 * review and follow-through"). Corrections redo the free reads at once (trackers, talk stats); the AI notes cost
 * several paid calls, so they are redone only when someone asks, once, after a batch of edits. Same people as editing
 * (the rep, or their manager in the tree); only on a call that has at least one correction; audit-logged; at most 3 per
 * 10 minutes per person. Runs after the response (as a trim does).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "transcript-refresh-notes", windowMs: 10 * 60_000, max: 3 });
  if (limited) return limited;
  const { id } = await params;
  const a = await access(req, id);
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Not authenticated." : "Session not found or not accessible." }, { status: a.status });
  if (!a.canEdit) return NextResponse.json({ error: "Only the rep on this call, or their manager, can refresh its notes." }, { status: 403 });
  if (a.session.status === "active") return NextResponse.json({ error: "This call is still live." }, { status: 409 });
  if (!isSalesCall(a.session.sessionKind)) return NextResponse.json({ error: "Only a sales call has AI notes to refresh." }, { status: 409 });
  const { count, error } = await a.db.from("transcript_line_edits").select("seq", { count: "exact", head: true }).eq("session_id", id);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ error: "Couldn't check the corrections. Try again." }, { status: 500 });
  }
  if (!count) return NextResponse.json({ error: "This call has no corrections — its notes already match its transcript." }, { status: 409 });

  const admin = createAdminClient();
  await recordAudit(admin, { companyId: a.ctx.companyId, actorId: a.ctx.userId, action: "transcript.refresh_notes", objectType: "coaching_session", objectId: id, meta: { corrections: count } });
  const session = a.session;
  after(async () => {
    try {
      const segments = await getSessionTranscript(id, admin);
      await generateSessionArtifacts({ companyId: a.ctx.companyId, actorId: a.ctx.userId, sessionId: id, session, segments });
    } catch (err) {
      console.error(`[transcript-edit] notes refresh failed session=${id}:`, err);
    }
  });
  return NextResponse.json({ ok: true, refreshing: true });
}
