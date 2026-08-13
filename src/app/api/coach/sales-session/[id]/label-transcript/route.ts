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
  replaceSessionTranscript,
} from "@/lib/data/salesCoach";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";

/**
 * POST /api/coach/sales-session/[id]/label-transcript (Live Sales Coach S1a)
 *
 * After the agent one-taps which diarized speaker is them, append the
 * labeled transcript: the agent's speaker → 'agent', everyone else →
 * 'customer'. Append-only (§3.1) for a CANONICAL transcript — this is
 * the record the review runs on, and one WITH agent turns is never
 * clobbered (409). The one narrow exception (2026-08-13, founder-
 * approved): a BROKEN, zero-agent-turns transcript (one-sided /
 * all-'unknown' — the "no after-pitch feedback" case) IS replaced on a
 * recovery re-transcribe, since it has no read value and isn't canonical.
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
  // an idempotent no-op, so a CANONICAL transcript cannot double even under a true race. The
  // `getSessionTranscript` check here is a NON-atomic fast-fail (TOCTOU) that 409s the double-label of a
  // transcript that HAS agent turns; it is defense-in-depth on top of the constraint, NOT the sole gate.
  // The [id]-page UI hiding the picker once a transcript exists is a third, purely-UX layer. Live coaching
  // writes via /finalize + /segments (NOT this route). EXCEPTION (2026-08-13): a BROKEN 0-agent-turns
  // transcript is replaceable by the recovery re-transcribe — see the gated delete just below.
  const existing = await getSessionTranscript(id);
  // A transcript WITH agent turns is CANONICAL — never clobber it (append-only, §A18): 409 the double-label.
  if (existing.some((s) => s.speaker === "agent")) {
    return NextResponse.json(
      {
        error:
          "This session already has a transcript — start a new session to log a different call.",
        alreadyHasTranscript: true,
      },
      { status: 409 }
    );
  }
  // Recovery overwrite (2026-08-13, founder-approved): if the existing transcript has ZERO agent turns it's a
  // BROKEN read (one-sided / all-`unknown` — the "no after-pitch feedback" case), not canonical data. The
  // re-transcribe is CORRECTING it, so delete the broken segments first so the re-diarized ones don't collide on
  // (session_id, seq) and no-op. Narrow, gated exception to append-only: only a 0-agent-turns transcript is
  // replaceable, and only the session's own rep reaches here (owner gate above). Concurrent recovery on ONE
  // session is a manual, single-agent action; the unique(session_id, seq) constraint still prevents a doubled
  // transcript, and whichever completes last yields a valid one (low-risk TOCTOU, same posture as the prior
  // fast-fail check this replaces).
  //
  // The overwrite is ATOMIC (replace_session_transcript RPC, 0212 — audit 2026-08-14 finding ①): delete-all +
  // insert-new in ONE transaction, rolled back together on any failure. A delete-then-append pair could delete
  // the old segments then fail the re-insert (appendTranscriptSegment swallows errors), leaving the transcript
  // destroyed-and-unreplaced or a locked partial. The atomic replace leaves the original intact on any failure.
  const labeled = body.segments.map((seg) => ({
    speaker: (seg.speakerId === body.agentSpeakerId ? "agent" : "customer") as "agent" | "customer",
    text: seg.text,
    seq: seg.seq,
  }));

  let appended = 0;
  if (existing.length > 0) {
    const replaced = await replaceSessionTranscript(id, labeled);
    if (!replaced.ok) {
      return NextResponse.json(
        { error: "Couldn't re-save this call's transcript. Your recording is safe — please try again." },
        { status: 500 }
      );
    }
    appended = replaced.count;
  } else {
    // First-ever label of a still-empty transcript — plain append, whose 23505 idempotency (the
    // unique(session_id, seq) constraint, 0208) makes a concurrent double-label a safe no-op.
    for (const seg of labeled) {
      const r = await appendTranscriptSegment({
        sessionId: id,
        speaker: seg.speaker,
        text: seg.text,
        seq: seg.seq,
      });
      if (r) appended += 1;
    }
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
  //
  // The ENTIRE scheduling block is wrapped so it is truly best-effort: getCurrentCompanyId() and
  // getSessionTranscript() can THROW (the latter rethrows a DB read error by contract — INV22), and they run
  // AFTER the append already succeeded. Without this guard, a transient read error here would 500 a label whose
  // transcript is saved — and the rep's retry would then hit the 409 already-has-transcript guard, a hard trap.
  // The append is the load-bearing result; generation is a bonus that a re-summarize / the backfill cron can
  // still supply, so a hiccup scheduling it must NEVER fail the label.
  if (appended > 0) {
    try {
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
            // The transcript is saved; a failed generation is recoverable (re-summarize / backfill cron).
            console.error(
              `[label-transcript] post-call artifact generation failed session=${id}:`,
              err
            );
          }
        });
      }
    } catch (err) {
      console.error(
        `[label-transcript] could not schedule post-call generation session=${id}:`,
        err
      );
    }
  }

  return NextResponse.json({ appended, requested: body.segments.length });
}
