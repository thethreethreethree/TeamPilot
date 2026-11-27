import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { loadLines, numberedTranscript } from "@/lib/coach/remote/followThrough";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { topicSectionsCoach } from "@/lib/claude";
import { coveredLines, parseSections, SECTION_LINES, TOPIC_SECTIONS_SYSTEM, type TopicSection } from "@/lib/coach/remote/topicSections";

export const maxDuration = 60;

/**
 * /api/coach/remote/:id/topic-sections — the call split by what was discussed (Gong F11.11; founder picker 2026-11-27
 * "On request per call"; topicSections.ts).
 *   GET  → { sections | null, lines, of } — the stored split for the call's CURRENT transcript (an older one may point
 *          at lines a trim or correction changed, so it isn't shown).
 *   POST → split it now (once per transcript version; a stored split is returned as is). One paid AI read.
 * The call and its lines are opened through the CALLER's client (calls' and transcripts' RLS: the rep, a manager the
 * tree allows, hidden calls refused), so a person can only split a call they could open. The result is an event on the
 * call (coach.session_topic_sections, the call's own company), which legal erasure deletes with the call's events.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KIND = "coach.session_topic_sections";
type Stored = { sections: TopicSection[]; transcript_version: number; lines: number; of: number };

async function open(req: NextRequest, id: string) {
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return null;
  const loaded = await loadLines(db, id, audioBaseIso(session.startedAt, session.audioStartedAt) ?? session.startedAt);
  return { db, session, loaded };
}

async function stored(db: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>, id: string, version: number): Promise<Stored | null | "failed"> {
  const { data, error } = await db
    .from("events")
    .select("payload, id")
    .eq("kind", KIND)
    .eq("subject", `sales_session:${id}`)
    .eq("payload->>transcript_version", String(version))
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return "failed";
  return data ? ((data.payload ?? null) as Stored | null) : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-topic-sections", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const o = await open(req, id);
  if (!o) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!o.loaded || !o.loaded.lines.length) return NextResponse.json({ sections: null, hasTranscript: false });
  const s = await stored(o.db, id, o.loaded.version);
  if (s === "failed") return NextResponse.json({ error: "Couldn't read this call's topic sections." }, { status: 500 });
  return NextResponse.json({ sections: s?.sections ?? null, lines: s?.lines ?? null, of: s?.of ?? null, hasTranscript: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-topic-sections-run", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const o = await open(req, id);
  if (!o) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (!isRemoteContext(o.session.context) || !isSalesCall(o.session.sessionKind ?? "sales")) return NextResponse.json({ error: "Topic sections are for phone and video sales calls." }, { status: 400 });
  if (!o.loaded || o.loaded.lines.length < 6) return NextResponse.json({ error: "This call's transcript is too short to split into topics." }, { status: 409 });
  const already = await stored(o.db, id, o.loaded.version);
  if (already === "failed") return NextResponse.json({ error: "Couldn't read this call's topic sections." }, { status: 500 });
  if (already) return NextResponse.json({ sections: already.sections, lines: already.lines, of: already.of, stored: true });
  const lines = o.loaded.lines.slice(0, SECTION_LINES).map((l) => ({ ...l, text: l.text.slice(0, 240) }));
  const ai = await topicSectionsCoach({
    companyId: ctx.companyId,
    systemPrompt: TOPIC_SECTIONS_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Transcript:\n${numberedTranscript(lines)}`,
    sessionId: id,
  });
  if (ai.suppressed) return NextResponse.json({ error: "The coach isn't answering on this account right now." }, { status: 409 });
  const sections = ai.text.trim() ? parseSections(ai.text, lines) : null;
  if (!sections) return NextResponse.json({ error: "The topic split didn't come back usable — try again." }, { status: 502 });
  // `lines`: how much of the call the sections cover (they may stop before the last line sent); `of`: the whole call.
  const payload: Stored = { sections, transcript_version: o.loaded.version, lines: coveredLines(sections, lines), of: o.loaded.lines.length };
  const { error } = await createAdminClient().from("events").insert({
    company_id: o.session.companyId,
    actor: ctx.userId,
    kind: KIND,
    subject: `sales_session:${id}`,
    payload,
  });
  if (error) {
    console.error(`[topic-sections] store failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "The topic split couldn't be saved — try again." }, { status: 500 });
  }
  return NextResponse.json({ sections, lines: payload.lines, of: payload.of, stored: false });
}
