import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { captureResolution } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/care/agent/conversations/[id]/resolution
 *
 * Captures the resolution learning for a conversation. Called from
 * the resolution-capture form when an agent marks a conversation
 * resolved. Two questions:
 *   - What was the actual issue? (issue_summary)
 *   - What worked? (what_worked)
 * Optional category drives pattern detection downstream.
 *
 * Also marks the conversation status='resolved' if the form was
 * submitted from the "resolve" path — the trigger from 0036 then
 * schedules a durability check 7 days out.
 */

const Body = z.object({
  issueSummary: z.string().min(5).max(2000),
  whatWorked: z.string().min(5).max(2000),
  category: z.string().max(120).optional(),
  precedentResolutionId: z.string().uuid().optional(),
  alsoMarkResolved: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const resolution = await captureResolution({
    conversationId: id,
    companyId: profile.company_id,
    capturedBy: auth.user.id,
    issueSummary: body.issueSummary,
    whatWorked: body.whatWorked,
    category: body.category ?? null,
    precedentResolutionId: body.precedentResolutionId ?? null,
  });

  if (body.category) {
    // Also stamp the category on the conversation for fast filtering
    // (pattern detection page reads from here directly).
    await sb
      .from("support_conversations")
      .update({ resolution_outcome_category: body.category })
      .eq("id", id);
  }

  if (body.alsoMarkResolved) {
    await sb
      .from("support_conversations")
      .update({ status: "resolved" })
      .eq("id", id);
  }

  return NextResponse.json({ resolution });
}
