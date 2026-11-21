import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { runFollowThrough, type Callback } from "@/lib/coach/remote/followThrough";

/**
 * /api/coach/remote/:id/follow-through — the AI's follow-through read of a phone/video call (RSS Phase 6; 0281).
 *   GET  → { available, read: null | { id, suggested: { outcome, why, seq } | "after-yours" | null, callbacks } }
 *   POST → read the call now (for calls processed before this shipped); then GET.
 *
 * §3.3 ENFORCED HERE, not in the panel: the AI's suggested outcome is returned only once the session has the rep's
 * own outcome. Before that the field is the string "after-yours", so no client can show the AI's answer first.
 * Read through the caller's client (RLS + 0273 tree); `callbacks[i].taskId` says which became tasks.
 */
const MISSING = new Set(["PGRST205", "42P01"]);

async function read(req: NextRequest, id: string) {
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return { status: 404 as const };
  if (!isRemoteContext(session.context)) return { status: 200 as const, body: { available: true, remote: false, read: null } };
  const { data: row, error } = await db
    .from("session_follow_through")
    .select("id, suggested_outcome, outcome_why, outcome_seq, callbacks, transcript_version")
    .eq("session_id", id)
    .order("transcript_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (MISSING.has(String(error.code))) return { status: 200 as const, body: { available: false, reason: "Follow-through is waiting on database migration 0281." } };
    console.error(`[follow-through] read failed session=${id}: ${error.message}`);
    return { status: 500 as const };
  }
  if (!row) return { status: 200 as const, body: { available: true, remote: true, read: null } };
  const { data: links } = await db.from("callback_tasks").select("item_index, task_id").eq("follow_through_id", row.id);
  const taskByIndex = new Map(((links ?? []) as Array<{ item_index: number; task_id: string }>).map((l) => [l.item_index, l.task_id]));
  const callbacks = ((row.callbacks ?? []) as Callback[]).map((c, i) => ({ ...c, taskId: taskByIndex.get(i) ?? null }));
  const suggested = session.outcome
    ? row.suggested_outcome
      ? { outcome: row.suggested_outcome as string, why: (row.outcome_why as string | null) ?? null, seq: (row.outcome_seq as number | null) ?? null }
      : null
    : "after-yours";
  return { status: 200 as const, body: { available: true, remote: true, read: { id: row.id, repOutcome: session.outcome, suggested, callbacks } } };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-follow-through", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const r = await read(req, id);
  if (r.status === 404) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  if (r.status === 500) return NextResponse.json({ error: "Couldn't load the follow-through." }, { status: 500 });
  return NextResponse.json(r.body);
}

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-follow-through-run", windowMs: 60_000, max: 6 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  // The caller must be able to open the call before the pipeline (service role) reads it.
  const session = await getSession(id, callerScopedDb(req) ?? (await createClient()));
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  if (!isRemoteContext(session.context)) return NextResponse.json({ error: "Follow-through is for phone and video calls." }, { status: 400 });
  const stored = await runFollowThrough(id);
  const r = await read(req, id);
  if (r.status !== 200) return NextResponse.json({ error: "Couldn't load the follow-through." }, { status: 500 });
  if (!stored && !(r.body as { read: unknown }).read) {
    return NextResponse.json({ error: "The coach couldn't read this call right now. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json(r.body);
}
