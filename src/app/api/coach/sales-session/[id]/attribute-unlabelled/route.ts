import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { answerableSpeaker } from "@/lib/coach/v5/transcriptRecovery";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";

/**
 * POST /api/coach/sales-session/[id]/attribute-unlabelled — answer "whose voice is this?"
 * for a transcript that is already saved but unattributed.
 *
 * WHY THIS EXISTS RATHER THAN REUSING /label-transcript. Recovery now saves a dropped
 * call's words as `unknown` when it cannot confidently say which voice is the rep. Those
 * words are already in the database, with their timing. The only thing missing is one
 * human answer. `/label-transcript` cannot supply it cheaply, because it rebuilds the
 * transcript from a payload the CLIENT sends — which for an already-saved transcript means:
 *
 *   - the client must echo every segment back, against a 5,000-segment cap;
 *   - `spoken_at` has to be RECONSTRUCTED from the stored timestamps and re-sent, and a
 *     payload that forgets to do that silently deletes the timing (the pace skill's input)
 *     in the very act of making the call coachable;
 *   - and the web After-Pitch card's only offer was to RE-TRANSCRIBE the audio — a second
 *     speech-to-text charge, on a recording of up to 42 minutes, to obtain words that are
 *     already sitting in the table.
 *
 * Here the server relabels the rows it already holds. Nothing is re-transcribed, nothing is
 * echoed, and `spoken_at` is never touched — so it cannot be lost.
 *
 * ONE QUESTION, TWO ANSWERS. `mine: true` means the recording caught the rep; `false` means
 * it caught only the customer, which is the genuine one-sided capture and a real answer, not
 * a failure. A transcript saved as `unknown` is by construction the case where the system
 * could not separate two voices, so there is exactly one voice to attribute.
 *
 * ONLY A ONE-VOICE TRANSCRIPT NO PERSON HAS ANSWERED. Two speakers on the record is
 * canonical and is refused — re-attributing captured two-sided speech wholesale is not a
 * correction, it is a deletion. A transcript a human has already answered (`source =
 * "manual"`) is refused too, for the reason that has always applied here: a person's answer
 * is not rewritten by a later opinion, including their own second one.
 *
 * WHAT WIDENED, AND WHY IT IS NOT THE THING THE SWEEP MUST NEVER DO (10 September 2026).
 * This used to accept ONLY `unknown`, so a transcript the diarizer had labelled entirely
 * `customer` was unfixable: the rep could see 160 words of their own pitch scoring nothing
 * and had no way to say "that was me". Measured on production the same day — of 2,414
 * stored segments, `source` is `null`, `loudness` or `content`, and NOT ONE is `manual`.
 * Every label in the database is a machine's guess, and six sessions are labelled entirely
 * `customer`, one of them opening "Okay. Well, the whole reason I got sent out here...".
 *
 * The recovery SWEEP still must not touch those, and does not: a machine second-guessing a
 * customer-only transcript would replace a real reading with a guess. The distinction is not
 * the label, it is WHO WROTE IT. A rep correcting a machine is the opposite act to a machine
 * overruling a rep, and only one of them is happening here.
 *
 * OWNER-ONLY: this writes the canonical transcript through the service role, which bypasses
 * RLS by design, so the ownership check has to be made here or it is not made at all. A
 * colleague must not answer for another rep's call — the answer decides whose voice every
 * coaching score is then computed from.
 *
 * A CITATION CORRECTED, because propagating it would be worse than the original slip: the
 * routes this sits beside attribute the owner-only rule to "A18". A18 is about the LABEL on
 * human-behaviour data surfaced to a leader — that a label invites either mentorship or
 * punishment — and says nothing about who may write a transcript. The rule is real; the
 * citation was not, and it is stated in plain words here instead of borrowed.
 */

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, {
    id: "sales-session-attribute-unlabelled",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const { id } = await context.params;
  // A phone sends a Bearer token and no cookie; a bare cookie client would read as
  // anonymous and 404 a session that exists.
  const db = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await db.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  let body: { mine?: unknown };
  try {
    body = (await req.json()) as { mine?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof body.mine !== "boolean") {
    // No default. Guessing which way a rep meant to answer is exactly the fabricated
    // attribution this whole path exists to avoid.
    return NextResponse.json(
      { error: "Say whose voice it is: send { mine: true } or { mine: false }." },
      { status: 400 }
    );
  }

  const session = await getSession(id, db);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }
  // The service role bypasses RLS, so this check is the only thing standing between a
  // colleague and another rep's canonical transcript.
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's rep can say whose voice this is." },
      { status: 403 }
    );
  }

  const existing = await getSessionTranscript(id, db);
  const answer = answerableSpeaker(existing);
  if (!answer.answerable) {
    if (answer.reason === "no-transcript") {
      return NextResponse.json(
        { status: "no-transcript", error: "This call has no transcript to attribute yet." },
        { status: 409 }
      );
    }
    if (answer.reason === "already-answered") {
      return NextResponse.json(
        {
          status: "already-attributed",
          error: "Somebody already said who spoke on this call, so it was not changed.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        status: "already-attributed",
        error: "This call caught both voices, so it already says who spoke and was not changed.",
      },
      { status: 409 }
    );
  }

  const speaker = body.mine ? "agent" : "customer";
  // The rep's answer already matches what is stored. Say so plainly and change nothing — a no-op
  // dressed as a save would claim work that did not happen, and re-running the engines would spend
  // real money to produce the read that is already there.
  if (answer.currentSpeaker === speaker) {
    return NextResponse.json({ status: "unchanged", speaker, labeled: 0 });
  }
  const admin = createAdminClient();
  // Scoped to the speaker we READ as well as the session, so a concurrent answer cannot be
  // overwritten by a slower one: the second update matches no rows and changes nothing. (It was
  // pinned to the literal "unknown" before; that would silently match nothing now that a machine
  // `customer` label is answerable, and report a save that changed no rows.)
  const { data: updated, error } = await admin
    .from("coaching_transcript_segments")
    .update({ speaker, source: "manual" })
    .eq("session_id", id)
    .eq("speaker", answer.currentSpeaker)
    .select("id");
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[attribute-unlabelled] update failed session=${id}: ${error.message}`);
    return NextResponse.json(
      { error: "Couldn't save that right now — your transcript is unchanged." },
      { status: 500 }
    );
  }
  const labeled = updated?.length ?? 0;

  /*
   * Regenerate the coaching artifacts, because this answer is what makes them possible.
   * Every engine filters on `speaker === "agent"`, so before this the call scored nothing;
   * after it, there is something to read.
   *
   * Only when the rep said the voice was THEIRS. An all-customer transcript still has no
   * agent turns, so generating would produce the same empty read at LLM cost — and the
   * talk-ratio caveat already states that case honestly.
   *
   * Via after() so the response returns immediately and the work survives the serverless
   * freeze; best-effort, since the attribution is already saved and the backfill cron can
   * still supply a missed generation.
   */
  if (labeled > 0 && body.mine) {
    try {
      const actorId = auth.user.id;
      const segments = await getSessionTranscript(id, admin);
      after(async () => {
        try {
          await generateSessionArtifacts({ companyId, actorId, sessionId: id, session, segments });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[attribute-unlabelled] artifact generation failed session=${id}:`, err);
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[attribute-unlabelled] could not schedule generation session=${id}:`, err);
    }
  }

  return NextResponse.json({ status: "attributed", speaker, labeled });
}
