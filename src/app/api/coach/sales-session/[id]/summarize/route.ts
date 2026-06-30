import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { runAndStoreSummary } from "@/lib/coach/v5/salesSummary";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";

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

  const summary = await runAndStoreSummary({
    companyId,
    actorId: auth.user.id,
    sessionId: id,
    segments,
  });
  return NextResponse.json({ summary });
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
  const { data } = await supabase
    .from("events")
    .select("payload")
    .eq("kind", "coach.session_summary_generated")
    .eq("subject", `sales_session:${id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const summary = (data?.payload as Record<string, unknown> | undefined)
    ?.summary;
  return NextResponse.json({
    summary: typeof summary === "string" ? summary : null,
  });
}
