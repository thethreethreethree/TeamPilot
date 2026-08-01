import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getSession, appendTranscriptSegment } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/[id]/label-transcript (Live Sales Coach S1a)
 *
 * After the agent one-taps which diarized speaker is them, append the
 * labeled transcript: the agent's speaker → 'agent', everyone else →
 * 'customer'. Append-only (§3.1) — this is the canonical stored
 * transcript the review runs on. The raw live 'unknown' segments (if
 * any) stay untouched; nothing is mutated.
 */

const BodySchema = z.object({
  agentSpeakerId: z.string().min(1).max(64),
  segments: z
    .array(
      z.object({
        speakerId: z.string().min(1).max(64),
        text: z.string().min(1).max(8000),
        seq: z.number().int().nonnegative(),
      })
    )
    .min(1)
    .max(5000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-label",
    windowMs: 60_000,
    max: 20,
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
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  // Owner-only: appendTranscriptSegment writes the canonical append-only transcript via the
  // SERVICE-ROLE client (bypasses RLS), and getSession is company-scoped (owner OR same-company
  // manager, per the 0084 policy). Without this, a colleague could POST fabricated segments into
  // another rep's transcript — poisoning the exact record the after-pitch review + coaching scores
  // run on (the A18 data-integrity rule). Mirrors the guard on cue / cue-outcome / segments (0082 class).
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's rep can label its transcript." },
      { status: 403 }
    );
  }

  let appended = 0;
  for (const seg of body.segments) {
    const speaker = seg.speakerId === body.agentSpeakerId ? "agent" : "customer";
    const r = await appendTranscriptSegment({
      sessionId: id,
      speaker,
      text: seg.text,
      seq: seg.seq,
    });
    if (r) appended += 1;
  }

  return NextResponse.json({ appended, requested: body.segments.length });
}
