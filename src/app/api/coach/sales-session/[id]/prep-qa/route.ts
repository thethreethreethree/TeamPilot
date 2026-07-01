import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { answerPrepQuestion } from "@/lib/coach/v5/salesPrepQA";

/**
 * POST /api/coach/sales-session/[id]/prep-qa  (Prep Time — build 2)
 *
 * The rep asks the coach a free-form question before a call; the coach
 * answers grounded in the product details + methodology + session context.
 * On-demand (§3.3 — the rep asked). RLS-gated via getSession. Control-exempt
 * is handled inside dissectCoachV5. Not stored — momentary prep, like /prep.
 */
const BodySchema = z.object({
  question: z.string().trim().min(2).max(1000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-prep-qa",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
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

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  const result = await answerPrepQuestion({
    companyId,
    session,
    question: body.question,
  });
  return NextResponse.json({ result });
}
