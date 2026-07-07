import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getSession,
  getSessionTranscript,
  appendTranscriptSegment,
} from "@/lib/data/salesCoach";
import { runAndStoreDissect } from "@/lib/coach/v5/salesDissect";
import { runAndStoreSummary } from "@/lib/coach/v5/salesSummary";
import { runAndStorePivot } from "@/lib/coach/v5/salesPivot";
import { runAndStoreMoments } from "@/lib/coach/v5/salesMoments";
import { runAndStoreIntel } from "@/lib/coach/v5/salesIntel";

/**
 * POST /api/coach/sales-session/[id]/finalize
 *
 * The SERVER-SIDE finalize (founder 2026-06-30, M3 structural fix). Admins
 * must reliably receive the complete Dissect for every (substantive)
 * session. The client calls this ONCE on Stop (with keepalive); the SERVER
 * — independent of whether the browser stays open — appends the transcript
 * and then generates + stores the Dissect and the Summary.
 *
 * This removes the tab-close failure of the old client-side fire-and-forget
 * (the LLM generation no longer depends on the browser staying alive). The
 * Dissect + Summary run in PARALLEL to fit the function budget; one failing
 * does not block the other. A thin session honestly produces no Dissect
 * (§3.4 — no fabrication).
 *
 * Residual holes (honest, §5 — NOT fully closed here): the request must
 * still REACH the server (network down at Stop), the agent must have
 * Stopped at all, and a very long transcript can exceed the 64KB keepalive
 * cap on immediate tab-close. A session left with a transcript but no
 * coach.dissect_generated event is DETECTABLE for a future backfill/retry.
 */
const SegmentInput = z.object({
  speaker: z.enum(["agent", "customer", "unknown"]),
  text: z.string().min(1).max(8000),
  seq: z.number().int().nonnegative(),
  spokenAt: z.string().datetime().optional(),
});
const Body = z.object({
  segments: z.array(SegmentInput).max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-finalize",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // RLS scopes this to the caller's company.
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  // 1. Append the live attributed transcript (append-only, §3.1).
  let appended = 0;
  for (const seg of body.segments ?? []) {
    const r = await appendTranscriptSegment({
      sessionId: id,
      speaker: seg.speaker,
      text: seg.text,
      seq: seg.seq,
      spokenAt: seg.spokenAt ?? null,
    });
    if (r) appended += 1;
  }

  // 2. Read the complete transcript (includes the just-appended turns + any
  //    earlier streamed segments).
  const segments = await getSessionTranscript(id);

  // 3. Generate + store the Dissect, Summary, Timeline, Pivot, and Intel
  //    SERVER-SIDE, in parallel. One failing does not block the others (each
  //    .catch); the pivot/timeline are stored alongside the summary so the
  //    Conversation-summary surface shows them the moment the call ends
  //    (workflow continuity, §1.5.1) — not only after a manual re-summarize.
  //
  //    RESILIENCE (audit 2026-07-07, AMD-006 L2): each call is also bounded by a
  //    timeout. This runs under keepalive; without the bound a single HUNG
  //    provider call would hold the whole route (and the response) until the
  //    platform kills the function, dropping every artifact. On timeout that one
  //    engine degrades to its empty fallback (same as a failure — the
  //    "Generate missing" backfill covers it) while the rest still persist. The
  //    happy path is unchanged.
  const CALL_TIMEOUT_MS = 25_000;
  const withTimeout = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((resolve) =>
        setTimeout(() => resolve(fallback), CALL_TIMEOUT_MS)
      ),
    ]);
  const [dissect, summary, moments, pivot, intel] = await Promise.all([
    withTimeout(
      runAndStoreDissect({
        companyId,
        actorId: auth.user.id,
        sessionId: id,
        segments,
        sessionTitle: session.clientLabel ?? undefined,
        context: session.context,
      }).catch(() => null),
      null
    ),
    withTimeout(
      runAndStoreSummary({
        companyId,
        actorId: auth.user.id,
        sessionId: id,
        segments,
      }).catch(() => null),
      null
    ),
    withTimeout(
      runAndStoreMoments({
        companyId,
        actorId: auth.user.id,
        sessionId: id,
        context: session.context,
        outcome: session.outcome,
        segments,
      }).catch(() => []),
      []
    ),
    withTimeout(
      runAndStorePivot({
        companyId,
        actorId: auth.user.id,
        sessionId: id,
        context: session.context,
        outcome: session.outcome,
        segments,
      }).catch(() => null),
      null
    ),
    withTimeout(
      runAndStoreIntel({
        companyId,
        actorId: auth.user.id,
        sessionId: id,
        context: session.context,
        segments,
      }).catch(() => null),
      null
    ),
  ]);

  return NextResponse.json({
    appended,
    transcriptSegments: segments.length,
    dissectGenerated: !!dissect?.hasSignal,
    summaryGenerated: !!summary,
    momentsGenerated: Array.isArray(moments) && moments.length > 0,
    pivotGenerated: !!pivot,
    intelGenerated: !!intel,
  });
}
