import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getSession, appendTranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — append diarized transcript segments (append-only).
 *
 * The realtime audio pipeline (subsystem 1, later) posts segments here
 * as speech is transcribed. Exposed now so the transcript path is
 * verifiable + testable before the pipeline exists (you can feed a
 * transcript by hand). Immutable: insert only (the DB enforces it).
 */

const SegmentSchema = z.object({
  speaker: z.enum(["agent", "customer", "unknown"]),
  text: z.string().min(1).max(8000),
  seq: z.number().int().nonnegative(),
  spokenAt: z.string().datetime().optional(),
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

  const supabase = await createClient();
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
    });
    if (r) inserted += 1;
  }
  return NextResponse.json({ inserted, requested: body.segments.length });
}
