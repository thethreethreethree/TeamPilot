import { NextRequest, NextResponse } from "next/server";
import { listKnowledgeResolutions } from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/knowledge
 *
 * Phase 7 commit 3 — the resolution corpus AS knowledge base.
 * Past resolutions ARE the institutional knowledge per §1.1
 * data-as-asset. This endpoint returns them browsable with
 * filters (category, capturedBy, outcome).
 *
 * Visibility: agents (and implicit company admins). Every
 * captured resolution is visible to anyone on the team — the
 * playbook is the team's playbook.
 *
 * Query params:
 *   category   — filter by exact category match
 *   capturedBy — filter by agent id
 *   outcome    — held / reopened / inconclusive
 *   limit      — defaults to 50
 */
export async function GET(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json(
      { error: "Knowledge base is for support agents." },
      { status: 403 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const category = searchParams.get("category");
  const capturedBy = searchParams.get("capturedBy");
  const outcomeParam = searchParams.get("outcome");
  const outcome =
    outcomeParam === "held" ||
    outcomeParam === "reopened" ||
    outcomeParam === "inconclusive"
      ? outcomeParam
      : null;
  const limitParam = searchParams.get("limit");
  // Audit finding: same windowDays bounds class as leadership
  // readouts. parseInt could be NaN or negative; clamp 1-200.
  const rawLimit = (limitParam ? parseInt(limitParam, 10) : 50) || 50;
  const limit = Math.max(1, Math.min(200, rawLimit));

  const { resolutions, categories } = await listKnowledgeResolutions({
    companyId: auth.companyId,
    category,
    capturedBy,
    outcome,
    limit,
  });

  return NextResponse.json({
    resolutions,
    categories,
  });
}
