import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getSession, appendTranscriptSegment } from "@/lib/data/salesCoach";
import { ATTRIBUTION_SOURCES } from "@/lib/coach/v5/speakerAttribution";

/**
 * Live Sales Coach — read (GET) / append (POST) diarized transcript segments.
 *
 * POST: the realtime audio pipeline posts segments here as speech is transcribed (append-only, OWNER-only).
 * GET (partner meeting 9/2 — John: admin access to full session transcripts for testing/feedback): read the
 * session's full transcript. RLS (0084) gates the read to the session's OWNER or a same-company admin/manager, so
 * an admin can open any of their team's sessions and read the transcript, and a peer rep sees nothing.
 */

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "sales-session-segments-get", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const { id } = await context.params;
  // Caller-scoped (web cookie OR mobile Bearer) so the 0084 RLS applies for THIS user — never the service role.
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb
    .from("coaching_transcript_segments")
    .select("speaker, text, seq, spoken_at")
    .eq("session_id", id)
    .order("seq", { ascending: true });
  if (error) {
    console.error("[sales-session/segments GET] read failed:", error.message); // CWE-209: log detail, return generic
    return NextResponse.json({ error: "Couldn't load the transcript." }, { status: 500 });
  }
  // An unauthorized session returns zero rows (RLS), so a peer sees an honest empty, never another rep's transcript.
  return NextResponse.json({ segments: data ?? [] });
}

const SegmentSchema = z.object({
  speaker: z.enum(["agent", "customer", "unknown"]),
  text: z.string().min(1).max(8000),
  seq: z.number().int().nonnegative(),
  spokenAt: z.string().datetime().optional(),
  source: z.enum(ATTRIBUTION_SOURCES).optional(), // 0236: why the speaker was assigned (single source of the values)
});

const BodySchema = z.object({
  segments: z.array(SegmentSchema).min(1).max(500),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-segments",
    windowMs: 60_000,
    max: 600,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  // The GET beside this one is caller-scoped and this was not, which is the
  // shape that hides: a route reads correctly for the app on one verb and
  // anonymously on the other.
  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // RLS-scoped read authorizes visibility; getSession returns owner OR same-company
  // manager (0084). But APPENDING transcript is OWNER-ONLY (audit 2026-07-09): migration
  // 0082 declared cross-agent transcript injection "a §A18 data-integrity hole …
  // corrupting the transcript the post-call review reasons from", and tightened the
  // direct-PostgREST INSERT to owner-only — but this service-role route re-opened it to
  // managers (the same "RLS-fixed, service-role-route-missed" class as the CRM vendor
  // fix). This route has no client caller (segments flow through /finalize's body), so
  // matching the cue-outcome/why owner-gate closes the hole with no workflow cost.
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's own rep can append its transcript." },
      { status: 403 }
    );
  }

  let inserted = 0;
  for (const seg of body.segments) {
    const r = await appendTranscriptSegment({
      sessionId: id,
      speaker: seg.speaker,
      text: seg.text,
      seq: seg.seq,
      spokenAt: seg.spokenAt ?? null,
      source: seg.source ?? null,
    });
    if (r) inserted += 1;
  }
  return NextResponse.json({ inserted, requested: body.segments.length });
}
