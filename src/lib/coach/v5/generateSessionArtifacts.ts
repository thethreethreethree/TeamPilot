import type { SalesSession, TranscriptSegment } from "@/lib/data/salesCoach";
import { runAndStoreDissect } from "./salesDissect";
import { scanCallForHidePhrases } from "@/lib/coach/remote/hidePhrases";
import { runAndStoreSummary } from "./salesSummary";
import { runAndStorePivot } from "./salesPivot";
import { runAndStoreMoments } from "./salesMoments";
import { runAndStoreIntel } from "./salesIntel";
import { withEngineTimeout, COACH_ENGINE_TIMEOUT_MS } from "./engineTimeout";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSalesCall } from "./salesOnly";
import { fireCallLinkedOnTranscript } from "@/lib/coach/remote/engage/agents";
import { scanSessionTrackers } from "@/lib/coach/remote/trackerScan";
import { scanSmartTrackers } from "@/lib/coach/remote/smartTrackerScan";
import { storeInteractionStats } from "@/lib/coach/remote/interactionStats";
import { runFollowThrough } from "@/lib/coach/remote/followThrough";
import { runCallBrief } from "@/lib/coach/remote/callBrief";
import { notifyCallReady } from "@/lib/coach/gamification/notify";

/**
 * generateSessionArtifacts — the shared "post-call generation" for a Sales Coach session.
 *
 * Runs the five post-call engines (Dissect, Summary, Timeline/Moments, Pivot, Intel) concurrently and
 * stores each server-side. Extracted (A16 drift-guard) so BOTH entry points generate the SAME artifact set
 * from one definition, instead of a copy-paste that silently drifts (the 40s-timeout change had to touch
 * finalize AND summarize precisely because the block was duplicated):
 *
 *   1. LIVE coaching → /finalize (on Stop): appends the live transcript, then calls this.
 *   2. UPLOADED recording → /label-transcript (after the "which voice is you?" tap): appends the labeled
 *      transcript, then calls this. WITHOUT this, an uploaded-recording session had a transcript but NO
 *      summary/dissect/pivot/moments/intel — so the Conversation-summary surface + the Sessions "Summary"
 *      badge were empty for every uploaded call (the founder-reported "new sessions have no summary page",
 *      2026-08-12), while live sessions worked. This closes that workflow gap (§1.5.1 Layer 3).
 *
 * RESILIENCE (mirrors finalize's rationale): each engine is bounded by the shared withEngineTimeout AND
 * wrapped in its own `.catch(fallback)`, so one engine failing or hanging degrades to its empty fallback
 * WITHOUT blocking the others — partial success is real (each runAndStore* persists its own result before
 * returning). A thin transcript honestly produces no dissect (§3.4 — no fabrication).
 *
 * The engines use the ADMIN (service-role) client internally and take companyId/actorId explicitly, so this
 * is safe to run OUTSIDE the request scope — e.g. via `after()` on the uploaded path (no request cookies
 * needed).
 */
export async function generateSessionArtifacts(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  session: Pick<SalesSession, "clientLabel" | "context" | "outcome" | "sessionKind">;
  segments: TranscriptSegment[];
  /**
   * The caller runs the call-added agents itself, after its reply (review residual 2026-11-28): /finalize answers the
   * rep, so an agent's AI read mustn't add to that request. Every other caller already runs this after its reply.
   */
  agentsLater?: boolean;
}) {
  const { companyId, actorId, sessionId, session, segments } = args;

  // SALES CALLS ONLY (2026-10-09, salesOnly.ts): a meeting or huddle gets every engine's "produced nothing" value
  // and no AI call. Meetings have their own review.
  if (!isSalesCall(session.sessionKind)) {
    return { dissect: null, summary: null, moments: [], pivot: null, intel: null };
  }

  // Keyword trackers (RSS Phase 3, migration 0276): match the transcript that just landed. Deterministic, no AI
  // call, never throws; phone/video sales sessions only (door sessions return 0 inside).
  await scanSessionTrackers(sessionId);
  // Hide-by-phrase (0337): an admin's phrase in this call's transcript hides it from all but its rep and admins.
  await scanCallForHidePhrases(null, sessionId); // never throws
  // Smart trackers (0329): one AI read of this call against all the company's smart trackers; none → no AI call.
  await scanSmartTrackers(sessionId);
  // Interaction stats (RSS Phase 2, migration 0277): deterministic, no AI call, never throws; phone/video only.
  await storeInteractionStats(sessionId);

  /*
    WHICH ENGINES RAN OUT OF TIME, so an uncoached call can be told apart from a quiet one.

    Every engine here degrades to the same empty value whether it timed out or genuinely had
    nothing to say, and until now nothing recorded which. Measured on production 10 September
    2026: artifact coverage COLLAPSES as the transcript grows — moments 87% on calls under 50
    words, 29% between 200 and 600 — which is backwards from "no signal" and is what a
    per-call time bound looks like from the outside.

    Collected here rather than in the timeout helper because this is the layer that knows the
    session and the company. One event per session at most, listing the engines and the size
    of the transcript that beat them, so the question "why was this call not coached?" has an
    answer in the record instead of a shrug.
  */
  const timedOut: string[] = [];
  const note = (engine: string) => () => {
    timedOut.push(engine);
  };

  // Follow-through (RSS Phase 6, migration 0281): AI-suggested outcome + callback to-dos, phone/video sales calls only
  // (returns null inside for door). Runs beside the five engines under the same time bound; never throws.
  const followThrough = withEngineTimeout(runFollowThrough(sessionId), null, note("follow_through"));
  // Remote Sales Macro Mode (0303): the call brief behind Highlights / Next Meeting. Same bound, never throws; null
  // for door calls.
  const callBrief = withEngineTimeout(runCallBrief(sessionId), null, note("call_brief"));

  const [dissect, summary, moments, pivot, intel] = await Promise.all([
    withEngineTimeout(
      runAndStoreDissect({
        companyId,
        actorId,
        sessionId,
        segments,
        sessionTitle: session.clientLabel ?? undefined,
        context: session.context,
      }).catch(() => null),
      null,
      note("dissect")
    ),
    withEngineTimeout(
      runAndStoreSummary({
        companyId,
        actorId,
        sessionId,
        segments,
      }).catch(() => null),
      null,
      note("summary")
    ),
    withEngineTimeout(
      runAndStoreMoments({
        companyId,
        actorId,
        sessionId,
        context: session.context,
        outcome: session.outcome,
        segments,
      }).catch(() => []),
      [],
      note("moments")
    ),
    withEngineTimeout(
      runAndStorePivot({
        companyId,
        actorId,
        sessionId,
        context: session.context,
        outcome: session.outcome,
        segments,
      }).catch(() => null),
      null,
      note("pivot")
    ),
    withEngineTimeout(
      runAndStoreIntel({
        companyId,
        actorId,
        sessionId,
        context: session.context,
        segments,
      }).catch(() => null),
      null,
      note("intel")
    ),
  ]);

  await followThrough;
  await callBrief;

  const words = segments.reduce(
    (n, seg) => n + String(seg.text ?? "").split(/\s+/).filter(Boolean).length,
    0
  );

  if (timedOut.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[generateSessionArtifacts] engines timed out session=${sessionId} engines=${timedOut.join(",")} words=${words}`
    );
    try {
      await createAdminClient()
        .from("events")
        .insert({
          company_id: companyId,
          actor: actorId,
          kind: "coach.engines_timed_out",
          subject: `sales_session:${sessionId}`,
          payload: {
            engines: timedOut,
            transcriptWords: words,
            timeoutMs: COACH_ENGINE_TIMEOUT_MS,
            coach_version: "artifacts-v1",
          },
        });
    } catch {
      // Best-effort: the console line above still records it, and a note that cannot be
      // taken must never fail the generation it was describing.
    }
  }

  /*
   * WHICH ENGINES RAN AND PRODUCED NOTHING, which until now left no trace at all.
   *
   * `salesDissect` records its own declines (a `coach.dissect_attempted` marker, so the
   * backfill backs off instead of re-billing a stuck session). The other four do not: a
   * summary, pivot, intel or moments run that comes back empty writes NO event, so "the
   * engine never ran" and "the engine ran and found nothing" are indistinguishable
   * afterwards. Measured on production 10 September 2026 across the 168 sessions the engines
   * can read: summary 83%, intel 70%, pivot 62%, MOMENTS 40% — and for none of that missing
   * 60% could anyone say which of the two it was.
   *
   * Recorded HERE rather than in four engines because this layer already holds all five
   * results and the transcript they were given. One event per session at most, and only when
   * something actually came back empty.
   *
   * It deliberately does NOT re-record a timeout: an engine the bound abandoned is already
   * named in `coach.engines_timed_out` above, and counting it twice would make the empty
   * count look worse than it is.
   */
  const empty: string[] = [];
  if (!dissect) empty.push("dissect");
  if (!summary) empty.push("summary");
  if (!moments || moments.length === 0) empty.push("moments");
  if (!pivot) empty.push("pivot");
  if (!intel) empty.push("intel");
  const emptyNotTimedOut = empty.filter((e) => !timedOut.includes(e));

  if (emptyNotTimedOut.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[generateSessionArtifacts] engines produced nothing session=${sessionId} engines=${emptyNotTimedOut.join(",")} words=${words}`
    );
    try {
      await createAdminClient()
        .from("events")
        .insert({
          company_id: companyId,
          actor: actorId,
          kind: "coach.engines_empty",
          subject: `sales_session:${sessionId}`,
          payload: {
            engines: emptyNotTimedOut,
            transcriptWords: words,
            coach_version: "artifacts-v1",
          },
        });
    } catch {
      // Best-effort, for the same reason as the timeout note: a record that cannot be taken
      // must never fail the generation it was describing.
    }
  }

  // RSS 0289: an uploaded phone/video call is ready — tell the rep once (notifyCallReady decides "uploaded" and dedupes).
  await notifyCallReady({ companyId, sessionId });
  // Engage E12 (0392): a call already on a deal runs its "call added" agents now that there's a transcript to read —
  // last, after the hide scan above (so a hidden call stays hidden from the agent's owner) and after the rep's own
  // coaching. Never throws; once per transcript version.
  if (!args.agentsLater) await fireCallLinkedOnTranscript(null, { companyId, sessionId });
  return { dissect, summary, moments, pivot, intel };
}
