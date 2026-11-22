import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { readBody } from "@/lib/api/validate";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { loadLines, numberedTranscript } from "@/lib/coach/remote/followThrough";
import { followUpDraftCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { FOLLOWUP_SYSTEM, parseFollowUp } from "@/lib/coach/remote/macroMode";

export const maxDuration = 60;

/**
 * /api/coach/remote/:id/followup — Highlights' "generate follow-up email / text" (MACRO-MODE-SPEC, 0303).
 *   GET  → { drafts: [{ id, channel, subject, body, createdAt }] } newest first (remote_followup_drafts' RLS).
 *   POST { channel: "email" | "text" } → write a draft from the call and its next steps; returns it.
 * Nothing is SENT from here: the rep copies, edits and sends it themselves (§3.3 — the rep stays the author).
 * Pushing into Salesforce/HubSpot is the spec's later step, not this one.
 */
const Body = z.object({ channel: z.enum(["email", "text"]) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-followup-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db
    .from("remote_followup_drafts")
    .select("id, channel, subject, body, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return NextResponse.json({ drafts: [], available: false });
    console.error(`[followup] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read the drafts." }, { status: 500 });
  }
  return NextResponse.json({
    available: true,
    drafts: ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      id: String(d.id),
      channel: d.channel,
      subject: d.subject ?? null,
      body: d.body,
      createdAt: d.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-followup-write", windowMs: 60_000, max: 8 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(session.context)) return NextResponse.json({ error: "Follow-ups are for phone and video calls." }, { status: 400 });

  const loaded = await loadLines(db, id, audioBaseIso(session.startedAt, session.audioStartedAt ?? null) ?? session.startedAt);
  if (!loaded || loaded.lines.length < 2) return NextResponse.json({ error: "This call has too little transcript to write from." }, { status: 422 });
  const { data: brief } = await db
    .from("remote_call_briefs")
    .select("next_steps")
    .eq("session_id", id)
    .order("transcript_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const steps = (Array.isArray(brief?.next_steps) ? brief.next_steps : []) as Array<{ text: string }>;

  const admin = createAdminClient();
  const { data: rep } = await admin.from("profiles").select("full_name").eq("company_id", session.companyId).eq("id", session.agentId).maybeSingle();
  const firstName = String(rep?.full_name ?? "").trim().split(/\s+/)[0] || "";

  const r = await followUpDraftCoach({
    companyId: session.companyId,
    systemPrompt: FOLLOWUP_SYSTEM + CONVERSATION_IS_DATA,
    userMessage:
      `channel: ${body.channel}\nrep first name: ${firstName || "(unknown)"}\nprospect label: ${session.clientLabel ?? "(unknown)"}\n` +
      `call date: ${session.startedAt.slice(0, 10)}\nnext steps agreed:\n${steps.map((s) => `- ${s.text}`).join("\n") || "(none found)"}\n\n` +
      `Transcript:\n${numberedTranscript(loaded.lines)}`,
    sessionId: id,
  });
  if (r.suppressed) return NextResponse.json({ error: "AI drafting is off for your company right now." }, { status: 409 });
  const draft = parseFollowUp(r.text, body.channel);
  if (!draft) return NextResponse.json({ error: "Couldn't write a follow-up from this call. Try again." }, { status: 502 });

  const { data: row, error } = await admin
    .from("remote_followup_drafts")
    .insert({
      session_id: id,
      company_id: session.companyId,
      rep_id: session.agentId,
      created_by: ctx.userId,
      channel: body.channel,
      subject: draft.subject,
      body: draft.body,
    })
    .select("id, created_at")
    .maybeSingle();
  if (error || !row) {
    console.error(`[followup] store failed session=${id}: ${error?.message ?? "no row"}`);
    // The draft is still useful to the rep even if it couldn't be kept.
    return NextResponse.json({ draft: { id: null, channel: body.channel, ...draft, createdAt: new Date().toISOString() }, stored: false });
  }
  return NextResponse.json({ draft: { id: String(row.id), channel: body.channel, ...draft, createdAt: row.created_at }, stored: true });
}
