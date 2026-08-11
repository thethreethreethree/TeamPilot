import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  getSession,
  getSessionTranscript,
  appendTranscriptSegment,
} from "@/lib/data/salesCoach";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";

/**
 * POST /api/coach/sales-session/[id]/label-transcript (Live Sales Coach S1a)
 *
 * After the agent one-taps which diarized speaker is them, append the
 * labeled transcript: the agent's speaker → 'agent', everyone else →
 * 'customer'. Append-only (§3.1) — this is the canonical stored
 * transcript the review runs on. The raw live 'unknown' segments (if
 * any) stay untouched; nothing is mutated.
 *
 * Then, for an UPLOADED-recording session, generate the post-call
 * artifacts (summary/dissect/pivot/moments/intel) from the labeled
 * transcript — the SAME set /finalize generates for a LIVE session
 * (shared generateSessionArtifacts). Without this, an uploaded call had
 * a transcript but no summary, so its Conversation-summary surface + the
 * Sessions "Summary" badge were empty while live sessions worked (the
 * founder-reported "new sessions have no summary page", 2026-08-12).
 */

// Generation runs the five post-call LLM engines (via after(), below), so this route needs the same duration
// budget as /finalize + /summarize; on Vercel's ~10-15s default the after() work would be killed mid-flight.
export const maxDuration = 60;

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

  // Post-call generation for the UPLOADED-recording flow. /finalize does this for LIVE sessions on Stop; the
  // uploaded flow lands here instead (upload → transcribe → this label step), so without it an uploaded call
  // never got a summary/dissect (founder 2026-08-12). Runs via after() so the label response returns
  // immediately — the rep taps through naming into the After-Pitch without waiting on a 40s spinner — while
  // the five engines complete SERVER-SIDE (they use the admin client + explicit companyId/actorId, so they
  // don't need the request scope; maxDuration=60 keeps the function alive). Best-effort: the transcript is
  // already saved (returned below) and each engine has its own fallback, so a generation hiccup never fails
  // the label. Only fires when we actually appended a fresh transcript (the 409 above already blocks a second
  // label), so it can't double-generate. The full transcript is read HERE (request scope — getSessionTranscript
  // is the RLS user client) and captured, since after() runs after the response.
  if (appended > 0) {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    if (companyId) {
      const actorId = auth.user.id;
      const fullTranscript = await getSessionTranscript(id);
      after(async () => {
        try {
          await generateSessionArtifacts({
            companyId,
            actorId,
            sessionId: id,
            session,
            segments: fullTranscript,
          });
        } catch (err) {
          // The transcript is already saved; a failed generation is recoverable (re-summarize / backfill cron).
          console.error(
            `[label-transcript] post-call artifact generation failed session=${id}:`,
            err
          );
        }
      });
    }
  }

  return NextResponse.json({ appended, requested: body.segments.length });
}
