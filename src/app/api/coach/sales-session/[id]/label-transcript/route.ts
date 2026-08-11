import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  getSession,
  getSessionTranscript,
  appendTranscriptSegment,
} from "@/lib/data/salesCoach";

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

  // APPEND-ONLY double-write class (§A18 data-integrity): this route only ever appends, so a SECOND
  // upload — or an upload on top of a live transcript that already saved — must not double the exact
  // record the after-pitch review + coaching scores run on.
  //
  // WHERE THE INVARIANT ACTUALLY HOLDS (audit 2026-08-11, F5 — don't mislead the next reader): the
  // STRUCTURAL gate is migration 0208's `unique(session_id, seq)` constraint — a concurrent double-label
  // both pass the read below, but the second's inserts hit 23505 and appendTranscriptSegment treats it as
  // an idempotent no-op, so the transcript cannot double even under a true race. The `getSessionTranscript`
  // check here is a NON-atomic fast-fail (TOCTOU) that gives a clean 409 for the common sequential/stale-
  // client case + a readable message; it is defense-in-depth on top of the constraint, NOT the sole gate.
  // The [id]-page UI hiding the picker once a transcript exists is a third, purely-UX layer. Live coaching
  // writes via /finalize + /segments (NOT this route), so none of this blocks a live save; the recovery
  // re-transcribe only fires when the transcript is empty, so it's unaffected.
  const existing = await getSessionTranscript(id);
  if (existing.length > 0) {
    return NextResponse.json(
      {
        error:
          "This session already has a transcript — start a new session to log a different call.",
        alreadyHasTranscript: true,
      },
      { status: 409 }
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
