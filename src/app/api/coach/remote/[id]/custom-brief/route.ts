import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { runBriefTemplate } from "@/lib/coach/remote/briefTemplatesRun";
import { loadLines } from "@/lib/coach/remote/followThrough";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import type { Answer, Section } from "@/lib/coach/remote/briefTemplates";

export const maxDuration = 60;

/**
 * /api/coach/remote/:id/custom-brief — a brief template run on this call (2026-11-26, Gong F13.2; migration 0364).
 *   GET  ?templateId= → { answers | null } — the stored run on the call's newest transcript, if any.
 *   POST { templateId } → runs it now (once per transcript version; a stored run is returned as is).
 * The call is opened through the CALLER's client first (coaching_sessions RLS: the rep, a manager the tree allows,
 * hidden calls refused), so a person can only brief a call they could open. The stored answers are read the same way
 * (custom_briefs' RLS). The run writes with the service role after that check; the template must be the company's and
 * live. Each answer cites the lines it rests on, or says the call didn't discuss it (briefTemplates.ts).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-custom-brief", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const templateId = new URL(req.url).searchParams.get("templateId") ?? "";
  if (!UUID.test(id) || !UUID.test(templateId)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  // Only a run on the call's CURRENT transcript (review 2026-11-26): after a trim, a correction or a relabel, an older
  // run may quote words that are no longer in the call — it is not shown, and the call can be briefed again.
  const loaded = await loadLines(db, id, audioBaseIso(session.startedAt, session.audioStartedAt) ?? session.startedAt);
  if (!loaded) return NextResponse.json({ available: true, brief: null });
  const { data, error } = await db
    .from("custom_briefs")
    .select("answers, transcript_version, created_at")
    .eq("session_id", id)
    .eq("template_id", templateId)
    .eq("transcript_version", loaded.version)
    .maybeSingle();
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false });
    console.error(`[custom-brief] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read that brief." }, { status: 500 });
  }
  return NextResponse.json({
    available: true,
    brief: data ? { answers: data.answers as Answer[], transcriptVersion: Number(data.transcript_version), createdAt: String(data.created_at) } : null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-custom-brief-run", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  let b: { templateId?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const templateId = typeof b.templateId === "string" ? b.templateId : "";
  if (!UUID.test(id) || !UUID.test(templateId)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context) || !isSalesCall(session.sessionKind ?? "sales")) return NextResponse.json({ error: "Brief templates run on phone and video sales calls." }, { status: 400 });
  const admin = createAdminClient();
  const { data: t, error: tErr } = await admin.from("brief_templates").select("id, sections, retired_at").eq("company_id", ctx.companyId).eq("id", templateId).maybeSingle();
  if (tErr) {
    if (MISSING.has(String(tErr.code))) return NextResponse.json({ error: "Brief templates are waiting on database migration 0364." }, { status: 503 });
    console.error(`[custom-brief] template read failed: ${tErr.message}`);
    return NextResponse.json({ error: "Couldn't run that brief." }, { status: 500 });
  }
  if (!t || t.retired_at) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  const r = await runBriefTemplate(admin, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    session: { id: session.id, companyId: session.companyId, agentId: session.agentId, startedAt: session.startedAt, audioStartedAt: session.audioStartedAt },
    template: { id: String(t.id), sections: t.sections as Section[] },
  });
  if (r === "empty") return NextResponse.json({ error: "This call has no transcript to brief yet." }, { status: 409 });
  if (r === "suppressed") return NextResponse.json({ error: "The coach isn't answering on this account right now." }, { status: 409 });
  if (!r) return NextResponse.json({ error: "Couldn't run that brief — try again." }, { status: 502 });
  return NextResponse.json({ brief: r });
}
