import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import {
  getSession,
  saveAfterPitchSummary,
  getLatestAfterPitchSummaryAdmin,
} from "@/lib/data/salesCoach";
import { generateAfterPitchSummary } from "@/lib/coach/v5/afterPitch";
import { getExperienceMode } from "@/lib/experience/mode";

/**
 * After Pitch Summary — the rep's "between doors" debrief.
 *
 *   POST /api/coach/sales-session/[id]/after-pitch  → generate + store
 *   GET  /api/coach/sales-session/[id]/after-pitch  → read back latest
 *
 * VISIBILITY (founder 2026-07-02, two decisions reconciled):
 *   - The REP (session owner) sees the FULL summary, including their private
 *     scoreboard.
 *   - ADMINS / MANAGERS in the same company see the summary too — so they can
 *     assess growth and provide guidance — but the private self-assessment
 *     SCORES are STRIPPED for them (A18: the scores are a mirror for the rep,
 *     not a manager scorecard; managers get the coaching substance —
 *     narrative, timeline, breakdown, cue-loop, focus — not the numbers).
 *
 * Structural privacy: the stored row stays owner-only by RLS (0080). Managers
 * never read it directly — the ONLY manager path is THIS route, which reads via
 * service role and strips `scores` before returning. `isManager` mirrors the
 * established sales-coach rule (company CEO/COO/admin OR sales_coach_role admin).
 */

type Viewer = {
  userId: string;
  isOwner: boolean;
  isManager: boolean;
};

/** Resolve the caller's relationship to the session. Returns null if not
 *  authenticated or not allowed to see the session at all. */
async function resolveViewer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionCompanyId: string,
  sessionAgentId: string
): Promise<Viewer | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const sameCompany = profile?.company_id === sessionCompanyId;
  // Consume the isSalesCoachManager AUTHORITY (skillAccess.ts) — do NOT re-derive the manager decision inline
  // (§2.2 / AMD-010 / A40). Every other sales-session route resolves "manager" through this one function; a
  // re-derived copy here would DRIFT — add a manager role to the authority and this after-pitch read would
  // silently withhold it, granting inconsistent visibility. Same-company scoping stays the route's own guard.
  const isManager =
    sameCompany &&
    isSalesCoachManager({
      role: (profile?.role as string | null) ?? null,
      sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
      company_id: null,
    });
  const isOwner = auth.user.id === sessionAgentId;

  if (!isOwner && !isManager) return null;
  return { userId: auth.user.id, isOwner, isManager };
}

/** Strip the private scores for non-owner (manager) views (A18). */
function forViewer(summary: unknown, isOwner: boolean): unknown {
  if (isOwner) return summary;
  if (summary && typeof summary === "object") {
    return { ...(summary as Record<string, unknown>), scores: [] };
  }
  return summary;
}

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
// Raised 60→300 (2026-08-14): over a 5–10 minute call's transcript the DeepSeek generation can run past 60s, and
// the function was being KILLED at the ceiling → a 504 the rep sees on the After-Pitch screen. 300s is the Pro
// plan max (the STT routes already use it). If a generation ever genuinely HANGS, the fix is an LLM-call timeout,
// not more ceiling — flagged.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-after-pitch",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const supabase = await createClient();

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const viewer = await resolveViewer(supabase, session.companyId, session.agentId);
  if (!viewer) {
    return NextResponse.json(
      { error: "Not authorized to view this summary." },
      { status: 403 }
    );
  }

  // The rep's own experience dial shapes the LENGTH of the read (spec p12: Standard
  // must be "LESS WORDY"). Read from the OWNER's preference, not the caller's — a
  // manager generating the summary must still see the rep's version, not their own
  // mode's. §3.4: Standard shortens presentation only, never omits a real finding.
  const mode = await getExperienceMode(supabase, session.agentId);

  const summary = await generateAfterPitchSummary({
    companyId: session.companyId,
    sessionId: id,
    context: session.context,
    outcome: session.outcome,
    mode,
  });

  if (summary.hasSignal) {
    // The summary is ALWAYS owned by the rep (agent_id = session.agentId),
    // even when a manager triggers generation — the row stays rep-private.
    await saveAfterPitchSummary({
      sessionId: id,
      companyId: session.companyId,
      agentId: session.agentId,
      payload: summary,
    });
    // Company-visible event — COARSE COUNTS ONLY, never the private scores.
    try {
      const breakdown = summary.moments.some((m) => m.isBreakdown);
      await supabase.from("events").insert({
        company_id: session.companyId,
        actor: viewer.userId,
        kind: "coach.after_pitch_summary_generated",
        subject: `sales_session:${id}`,
        payload: {
          moments_count: summary.moments.length,
          has_breakdown: breakdown,
          cue_loop_count: summary.cueLoop.length,
          focus_present: summary.focus !== null,
          coach_version: "after-pitch-v1",
        },
      });
    } catch {
      /* event emit is best-effort; the summary still returns */
    }
  }

  return NextResponse.json({
    summary: forViewer(summary, viewer.isOwner),
    isOwner: viewer.isOwner,
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const session = await getSession(id);
  if (!session) {
    // 404 also covers "not allowed to read the session" (RLS returned null).
    return NextResponse.json({ summary: null, isOwner: false });
  }
  const viewer = await resolveViewer(supabase, session.companyId, session.agentId);
  if (!viewer) {
    return NextResponse.json({ summary: null, isOwner: false });
  }

  const stored = await getLatestAfterPitchSummaryAdmin(id);
  return NextResponse.json({
    summary: stored ? forViewer(stored, viewer.isOwner) : null,
    isOwner: viewer.isOwner,
  });
}
