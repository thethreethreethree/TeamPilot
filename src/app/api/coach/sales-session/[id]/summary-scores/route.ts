import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateSalesScores } from "@/lib/coach/v5/salesScore";
import {
  getSession,
  getSessionTranscript,
  getLatestAfterPitchSummaryAdmin,
} from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/[id]/summary-scores
 *
 * The OWNER-PRIVATE scores for the summary surfaces (Summarize panel +
 * Conversation summary). Mirrors the After-Pitch rubric (§A21 — reuses
 * generateSalesScores, the same 5 categories) but exposes it on the summary
 * surfaces per the founder's 2026-07-07 request.
 *
 * §A18 — CRITICAL: the scores are a rep's PRIVATE self-assessment, not a
 * manager's performance readout. The Conversation-summary session page is
 * manager-visible (the 0084 RLS policy lets a same-company manager open a rep's
 * session), so this endpoint is the structural defense: it returns scores ONLY
 * to the session OWNER (agent_id === caller). A manager — even a company admin —
 * gets 403 and no scores, exactly as the After-Pitch route strips scores for
 * non-owners. Generated on demand (not persisted in the manager-readable events
 * table) so there is no manager-reachable copy anywhere.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-summary-scores",
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

  // §A18 owner gate — scores are private to the rep who ran the call. A manager
  // who can VIEW the session (0084 RLS) still cannot read its scores.
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Scores are private to the rep who ran this call." },
      { status: 403 }
    );
  }

  // §A21 consistency: if the rep already generated an After Pitch Summary, reuse
  // ITS scores so the same call never shows two different numbers across
  // surfaces (the graded categories are LLM, so a fresh run would drift). Safe
  // to read the owner's own after-pitch payload here — ownership is verified
  // above. Only generate fresh when there is no prior After Pitch to reuse.
  const priorPayload = (await getLatestAfterPitchSummaryAdmin(id).catch(
    () => null
  )) as { scores?: unknown } | null;
  const priorScores = Array.isArray(priorPayload?.scores)
    ? priorPayload.scores
    : null;
  if (priorScores && priorScores.length > 0) {
    return NextResponse.json({ scores: priorScores, hasSignal: true });
  }

  const segments = await getSessionTranscript(id);
  if (segments.length === 0) {
    return NextResponse.json({ scores: [], hasSignal: false });
  }

  const result = await generateSalesScores({
    companyId,
    context: session.context,
    segments,
  });
  return NextResponse.json({
    scores: result.categories,
    hasSignal: result.hasSignal,
  });
}
