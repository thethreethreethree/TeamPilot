import type { SalesSession, TranscriptSegment } from "@/lib/data/salesCoach";
import { runAndStoreDissect } from "./salesDissect";
import { runAndStoreSummary } from "./salesSummary";
import { runAndStorePivot } from "./salesPivot";
import { runAndStoreMoments } from "./salesMoments";
import { runAndStoreIntel } from "./salesIntel";
import { withEngineTimeout } from "./engineTimeout";

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
  session: Pick<SalesSession, "clientLabel" | "context" | "outcome">;
  segments: TranscriptSegment[];
}) {
  const { companyId, actorId, sessionId, session, segments } = args;
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
      null
    ),
    withEngineTimeout(
      runAndStoreSummary({
        companyId,
        actorId,
        sessionId,
        segments,
      }).catch(() => null),
      null
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
      []
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
      null
    ),
    withEngineTimeout(
      runAndStoreIntel({
        companyId,
        actorId,
        sessionId,
        context: session.context,
        segments,
      }).catch(() => null),
      null
    ),
  ]);
  return { dissect, summary, moments, pivot, intel };
}
