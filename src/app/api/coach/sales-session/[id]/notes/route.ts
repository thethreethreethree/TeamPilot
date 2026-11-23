import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { transcriptTextForStorage } from "@/lib/coach/remote/redact";

/**
 * /api/coach/sales-session/:id/notes — the rep's notes on a call (2026-11-23; migration 0316; Gong F9.20; founder picker:
 * readable by the call's rep and their managers).
 *   GET  → { canWrite, notes: [{ id, atMs, body, authorName, createdAt }] } — whoever can open the call reads them.
 *   POST { body, atMs? } → a new note. Only the call's own rep writes (0316's insert policy is the gate; checked here
 *        too for a clear message). atMs: the given position in the recording, or — during a live call — now minus the
 *        call's start, so a note taken live can later play from that moment. Append-only: a correction is a new note.
 * Notes get the same number redaction as transcripts (D15), so a card number typed in is not stored.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Call notes are waiting on database migration 0316.";
const MAX_MS = 6 * 3_600_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-notes-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const { data, error } = await db.from("call_notes").select("id, author_id, at_ms, body, created_at").eq("session_id", id).order("id", { ascending: true }).limit(500);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ canWrite: false, notes: [], notReady: NOT_READY });
    console.error(`[call-notes] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the notes." }, { status: 500 });
  }
  const rows = (data ?? []) as Array<{ id: number; author_id: string; at_ms: number | null; body: string; created_at: string }>;
  const authors = [...new Set(rows.map((r) => r.author_id))];
  const { data: people } = authors.length ? await db.from("profiles").select("id, full_name").in("id", authors) : { data: [] };
  const nameOf = new Map(((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]));
  return NextResponse.json({
    canWrite: session.agentId === ctx.userId,
    notes: rows.map((r) => ({ id: r.id, atMs: r.at_ms, body: r.body, authorName: nameOf.get(r.author_id) ?? null, createdAt: r.created_at })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "call-notes-write", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (session.agentId !== ctx.userId) return NextResponse.json({ error: "Only the rep on this call can add notes to it." }, { status: 403 });
  let b: { body?: unknown; atMs?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (text.length < 1 || text.length > 2000) return NextResponse.json({ error: "Write a note (up to 2000 characters)." }, { status: 400 });
  let atMs: number | null = null;
  if (typeof b.atMs === "number" && Number.isFinite(b.atMs) && b.atMs >= 0 && b.atMs <= MAX_MS) atMs = Math.round(b.atMs);
  else if (session.status === "active") {
    const base = audioBaseIso(session.startedAt, session.audioStartedAt);
    const t = base ? Date.now() - Date.parse(base) : NaN;
    if (Number.isFinite(t) && t >= 0 && t <= MAX_MS) atMs = Math.round(t);
  }
  const { data, error } = await db
    .from("call_notes")
    .insert({ company_id: ctx.companyId, session_id: id, author_id: ctx.userId, at_ms: atMs, body: transcriptTextForStorage(text) })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[call-notes] write failed session=${id}: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't save the note." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id, atMs });
}
