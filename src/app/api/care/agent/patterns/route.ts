import { NextRequest, NextResponse } from "next/server";
import {
  detectCoachRiskPatterns,
  detectSupportPatterns,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/patterns
 *
 * Returns two kinds of patterns the System has surfaced:
 *
 *   issuePatterns — recurring customer-issue categories that
 *                    crossed the §3.2 Understanding Gate threshold
 *                    (≥3 resolutions of the same category in the
 *                    window). This is "what customers keep asking
 *                    about" — the earliest warning system for
 *                    product/process/messaging gaps.
 *
 *   replyShapePatterns — team-level Coach v6 risk patterns. When
 *                    a specific risk category (unsupported
 *                    absolutes, fabricated specifics, empty
 *                    filler) accumulates across the team's
 *                    replies, it surfaces here. Per §A18 this is
 *                    TEAM-LEVEL ONLY — there is no per-agent
 *                    breakdown by design. Often these patterns
 *                    point to gaps in product context (the cause)
 *                    rather than to bad agents (the symptom).
 *
 * Both pattern kinds are §A11 counts with sample §3.1 events
 * (conversation ids) so the user can verify the pattern is real
 * (§A14 multi-state render — the supporting events are a verified
 * drill-through branch).
 *
 * Query params:
 *   windowDays — defaults to 30
 */
export async function GET(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json(
      { error: "No company on profile." },
      { status: 403 }
    );
  }

  const windowDaysParam = req.nextUrl.searchParams.get("windowDays");
  // Audit finding: parseInt unclamped. Pattern detection uses
  // the same 1-365 day bound as leadership readouts.
  const rawWindowDays =
    (windowDaysParam ? parseInt(windowDaysParam, 10) : 30) || 30;
  const windowDays = Math.max(1, Math.min(365, rawWindowDays));

  const [issuePatterns, replyShapePatterns] = await Promise.all([
    detectSupportPatterns({ windowDays }),
    detectCoachRiskPatterns({
      companyId: auth.companyId,
      windowDays,
    }),
  ]);

  return NextResponse.json({
    // Legacy field name kept for back-compat with the RTM home
    // (ef586f4) that already consumes the old shape. Identical
    // contents to issuePatterns. The RTM home reads this on the
    // current path; a follow-up commit can switch it to read
    // issuePatterns directly and we'll deprecate the legacy field.
    patterns: issuePatterns,
    issuePatterns,
    replyShapePatterns,
    windowDays,
  });
}
