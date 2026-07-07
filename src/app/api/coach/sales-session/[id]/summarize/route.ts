import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { runAndStoreSummary } from "@/lib/coach/v5/salesSummary";
import { runAndStorePivot, type PivotMoment } from "@/lib/coach/v5/salesPivot";
import {
  runAndStoreMoments,
  type SalesMoment,
} from "@/lib/coach/v5/salesMoments";
import { runAndStoreIntel, type SalesIntel } from "@/lib/coach/v5/salesIntel";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";

// Four LLM engines run concurrently below; each is bounded by an in-code timeout,
// so the platform must allow the function to run at least that long or it would be
// killed mid-flight (dropping the response the user is waiting on, since this runs
// on tab-open). Declares the duration budget the timeout assumes. (§A21 — parity
// with the finalize route, which sets the same.)
export const maxDuration = 60;

/**
 * POST /api/coach/sales-session/[id]/summarize
 *
 * On-demand summarize for a session. Generates + stores the distinct
 * factual summary via runAndStoreSummary — the SAME mechanism the
 * server-side finalize uses (§A21, one place). Per §A11 the summary
 * surfaces FACTS, not a verdict on the agent.
 */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-summarize",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  // §3.4 + §A21: match the dissect route's contract — no company context is a
  // hard stop, so this never runs UNGATED (skipping the month-1 control gate)
  // just because companyId happened to be null. (If you later decide factual
  // summaries should be EXEMPT from the control gate per §A11, that's a
  // deliberate change here — documented, not an accident of `?? undefined`.)
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const segments = await getSessionTranscript(id);
  if (segments.length === 0) {
    return NextResponse.json(
      { error: "Nothing to summarize yet — no transcript." },
      { status: 400 }
    );
  }

  // Compose (§A16, does not fork): the factual summary, the Conversation Timeline
  // (3-5 key moments hero), AND the bidirectional Pivot Moment run concurrently.
  // All three are manager-visible observations (the owner-private SCORES are a
  // separate owner-only endpoint, §A18).
  //
  // RESILIENCE (§A21 — brought to parity with the finalize route): each engine is
  // wrapped in its OWN .catch(fallback) + a timeout. Without the .catch, one engine
  // throwing would reject Promise.all and 500 the WHOLE route — the user would get
  // NOTHING even though the summary itself succeeded. Each runAndStore* persists its
  // own result internally before returning, so partial success is real: a failed
  // timeline still leaves the summary + pivot + intel stored and returned. The
  // timeout bounds a hung provider call to the same fallback.
  const CALL_TIMEOUT_MS = 25_000;
  const withTimeout = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((resolve) =>
        setTimeout(() => resolve(fallback), CALL_TIMEOUT_MS)
      ),
    ]);
  const [summary, moments, pivot, intel] = await Promise.all([
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
      }).catch(() => [] as SalesMoment[]),
      [] as SalesMoment[]
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
  return NextResponse.json({ summary, moments, pivot, intel });
}

/**
 * GET /api/coach/sales-session/[id]/summarize
 *
 * Read back the most recent persisted summary for a session (no LLM cost),
 * so the session page can show the auto-generated summary.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // Read back the latest factual summary AND the latest Pivot Moment (both are
  // manager-visible observations, stored append-only in `events`). No LLM cost.
  // Owner-private SCORES are NOT here — they come from the owner-gated
  // /summary-scores endpoint (§A18).
  const latest = (kind: string) =>
    supabase
      .from("events")
      .select("payload")
      .eq("kind", kind)
      .eq("subject", `sales_session:${id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  const [summaryRow, momentsRow, pivotRow, intelRow] = await Promise.all([
    latest("coach.session_summary_generated"),
    latest("coach.session_moments_generated"),
    latest("coach.session_pivot_generated"),
    latest("coach.session_intel_generated"),
  ]);
  const summary = (summaryRow.data?.payload as Record<string, unknown> | undefined)
    ?.summary;
  const moments = (momentsRow.data?.payload as Record<string, unknown> | undefined)
    ?.moments as SalesMoment[] | undefined;
  const pivot = (pivotRow.data?.payload as Record<string, unknown> | undefined)
    ?.pivot as PivotMoment | undefined;
  const intel = (intelRow.data?.payload as Record<string, unknown> | undefined)
    ?.intel as SalesIntel | undefined;
  return NextResponse.json({
    summary: typeof summary === "string" ? summary : null,
    moments: Array.isArray(moments) ? moments : [],
    pivot: pivot ?? null,
    intel: intel ?? null,
  });
}
