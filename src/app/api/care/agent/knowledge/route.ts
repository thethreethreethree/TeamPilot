import { NextRequest, NextResponse } from "next/server";
import { listKnowledgeResolutions } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

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
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent || !profile?.company_id) {
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
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

  const { resolutions, categories } = await listKnowledgeResolutions({
    companyId: profile.company_id,
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
