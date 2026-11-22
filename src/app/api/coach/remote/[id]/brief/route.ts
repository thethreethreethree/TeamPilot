import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { briefFromRow, runCallBrief } from "@/lib/coach/remote/callBrief";

export const maxDuration = 60;

/**
 * /api/coach/remote/:id/brief — the call brief behind Macro Mode's Highlights and Next Meeting tabs (0303).
 *   GET  → { available, brief: null | {...}, review: null | { kept, createdAt } }
 *   POST → brief the call now (calls processed before this shipped, or a failed first read); then GET.
 * Read through the caller's client, so remote_call_briefs' RLS (owner, or a manager in the tree) is the gate.
 */
const MISSING = new Set(["PGRST205", "42P01"]);

async function read(req: NextRequest, id: string) {
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return { status: 404 as const, body: { error: "Call not found." } };
  if (!isRemoteContext(session.context)) return { status: 200 as const, body: { available: true, remote: false, brief: null, review: null } };
  const { data: row, error } = await db
    .from("remote_call_briefs")
    .select("id, key_points, next_steps, next_meeting, transcript_version, created_at")
    .eq("session_id", id)
    .order("transcript_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (MISSING.has(String(error.code))) return { status: 200 as const, body: { available: false, reason: "The call brief is waiting on database migration 0303." } };
    console.error(`[call-brief] read failed session=${id}: ${error.message}`);
    return { status: 500 as const, body: { error: "Couldn't read the call brief." } };
  }
  // Which prospect this call belongs to (0303), so the tabs can offer "Add to pipeline" or show the link.
  const { data: link } = await db.from("remote_prospect_calls").select("prospect_id").eq("session_id", id).maybeSingle();
  let prospect: { id: string; name: string | null; status: string; nextCallDate: string | null } | null = null;
  if (link?.prospect_id) {
    const { data: pc } = await db.from("remote_prospects_current").select("id, name, status, next_call_date").eq("id", link.prospect_id).maybeSingle();
    if (pc) prospect = { id: String(pc.id), name: pc.name ?? null, status: String(pc.status), nextCallDate: pc.next_call_date ?? null };
  }
  const label = session.clientLabel ?? null;
  if (!row) return { status: 200 as const, body: { available: true, remote: true, brief: null, review: null, prospect, label } };
  const { data: rev } = await db
    .from("remote_checklist_reviews")
    .select("kept, created_at")
    .eq("brief_id", row.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    status: 200 as const,
    body: {
      available: true,
      remote: true,
      brief: briefFromRow(row as never),
      review: rev ? { kept: rev.kept, createdAt: rev.created_at } : null,
      prospect,
      label,
    },
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-brief-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const r = await read(req, id);
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-brief-run", windowMs: 60_000, max: 6 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  // The caller must be able to see the call (RLS) before the service role is asked to read it.
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context)) return NextResponse.json({ error: "Only phone and video calls have a call brief." }, { status: 400 });
  const briefId = await runCallBrief(id);
  if (!briefId) {
    return NextResponse.json({ error: "Couldn't brief this call — it may have too little transcript yet." }, { status: 422 });
  }
  const r = await read(req, id);
  return NextResponse.json(r.body, { status: r.status });
}
