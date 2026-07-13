import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSession } from "@/lib/data/salesCoach";
import { generatePrep } from "@/lib/coach/v5/salesPrep";

/**
 * POST /api/coach/sales-session/[id]/prep  (Live Coach Step 3)
 *
 * Generate a SHORT pre-knock briefing for this session on demand (the rep
 * clicks "Prep me" before knocking). Reads the session's Phase 2 capture +
 * the methodology corpus; never stored (it's momentary prep, regenerated on
 * request). RLS-gated via getSession. Control-exempt (Sales Coach is exempt
 * from month-1 control) is handled inside dissectCoachV5.
 */
// LLM route: longer serverless budget than Vercel's short default (awaits an LLM call via a lib helper).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-prep",
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

  // RLS-scoped read = the access check.
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  const prep = await generatePrep({ companyId, session });
  return NextResponse.json({ prep });
}
