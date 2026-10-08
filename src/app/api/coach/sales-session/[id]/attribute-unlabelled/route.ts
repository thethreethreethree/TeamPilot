import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { answerableSpeaker } from "@/lib/coach/v5/transcriptRecovery";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { transcriptVoices } from "@/lib/coach/v5/transcriptVoices";

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
 * a failure.
 *
 * …UNLESS THE CALL HAS TWO VOICES (corrected 2026-10-08). This used to say an `unknown`
 * transcript is "by construction" one voice. It is not: recovery also saves every line
 * `unknown` when it separated two voices but could not tell which is the rep, and `mine: true`
 * then made the customer's lines the rep's. Each line now keeps its voice id (0270), and when
 * transcriptVoices finds two or more the answer is `{ agentCluster }` — which voice is the rep —
 * written by assign_session_voices as a new version. `mine: true` is refused there with the
 * voices to choose from; `mine: false` ("none of these is me") still marks the call customer-only.
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
  const companyId = await callerCompanyId(db, auth.user.id);
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  let body: { mine?: unknown; agentCluster?: unknown };
  try {
    body = (await req.json()) as { mine?: unknown; agentCluster?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const agentCluster =
    typeof body.agentCluster === "string" && body.agentCluster.length > 0 && body.agentCluster.length <= 64
      ? body.agentCluster
      : null;
  if (typeof body.mine !== "boolean" && !agentCluster) {
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

  const actorId = auth.user.id;
  /**
   * Regenerate the coaching artifacts, because this answer is what makes them possible. Every engine filters on
   * `speaker === "agent"`, so before an answer the call scored nothing. Via after() so the response returns at
   * once and the work survives the serverless freeze; best-effort, since the answer is already saved and the
   * backfill cron can still supply a missed generation.
   */
  const scheduleArtifacts = async (admin: ReturnType<typeof createAdminClient>) => {
    try {
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
  };

  // TWO OR MORE VOICES: ask which one is the rep (see the header). One verdict, shared with the web card.
  const voices = transcriptVoices(existing);
  if (voices) {
    if (agentCluster) {
      if (!voices.some((v) => v.cluster === agentCluster)) {
        return NextResponse.json({ error: "That voice isn't on this call." }, { status: 400 });
      }
      const admin = createAdminClient();
      // A new version: that voice 'agent', every other voice 'customer', the old version kept (§3.1).
      const { data: assigned, error } = await admin.rpc("assign_session_voices", {
        p_session_id: id,
        p_agent_cluster: agentCluster,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[attribute-unlabelled] assign failed session=${id}: ${error.message}`);
        return NextResponse.json(
          { error: "Couldn't save that right now — your transcript is unchanged." },
          { status: 500 }
        );
      }
      const labeled = typeof assigned === "number" ? assigned : 0;
      if (labeled === 0) {
        // The function re-checks under a lock; 0 means the call changed (another answer landed) since it was read.
        return NextResponse.json(
          { status: "already-attributed", error: "This call was answered a moment ago, so it was not changed." },
          { status: 409 }
        );
      }
      await scheduleArtifacts(admin);
      return NextResponse.json({ status: "attributed", speaker: "agent", agentCluster, labeled });
    }
    if (body.mine === true) {
      return NextResponse.json(
        {
          status: "needs-voice",
          error: "This call has more than one voice — say which one is you.",
          voices: voices.map(({ cluster, sample }) => ({ cluster, sample })),
        },
        { status: 409 }
      );
    }
    // mine: false — none of these voices is the rep: the call is marked customer-only below, as before.
  } else if (agentCluster) {
    return NextResponse.json(
      { error: "This call has one voice — answer with { mine: true } or { mine: false }." },
      { status: 400 }
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
  /*
   * A NEW VERSION, NOT AN UPDATE (2026-10-03). This was `.update({ speaker, source: "manual" })`, and the
   * table's append-only rule (0070 `_no_update`) turns every UPDATE into nothing: it changed no row and the
   * route still answered "attributed". No segment in production has ever had source "manual". Now
   * relabel_session_transcript (0269) copies the current version into a new one with this speaker changed;
   * the old version stays as history (founder picker 2026-10-03: keep history).
   *
   * Still scoped to the speaker we READ: the function changes only rows that are `answer.currentSpeaker` in the
   * current version, so a second, slower answer finds none and writes nothing.
   */
  const { data: relabeled, error } = await admin.rpc("relabel_session_transcript", {
    p_session_id: id,
    p_from: answer.currentSpeaker,
    p_to: speaker,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[attribute-unlabelled] update failed session=${id}: ${error.message}`);
    return NextResponse.json(
      { error: "Couldn't save that right now — your transcript is unchanged." },
      { status: 500 }
    );
  }
  const labeled = typeof relabeled === "number" ? relabeled : 0;

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
  if (labeled > 0 && body.mine) await scheduleArtifacts(admin);

  return NextResponse.json({ status: "attributed", speaker, labeled });
}
