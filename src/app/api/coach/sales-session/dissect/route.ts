import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { runAndStoreDissect } from "@/lib/coach/v5/salesDissect";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/dissect  { sessionId }
 *
 * The "Dissect" — a deep, full-conversation teaching evaluation of a Live
 * Sales Coach session: detailed strengths, growth opportunities, the
 * standout strategy the agent used, and an overall teaching note. Distinct
 * from (and additional to) the quick growth review. Stored as an
 * append-only event (coach.dissect_generated, §3.1/§3.6) so re-opening
 * reads it back without re-spending an LLM call.
 *
 * GET ?sessionId=… reads back the most recent stored dissect.
 */
const BodySchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-sales-dissect",
    windowMs: 60_000,
    max: 12,
  });
  if (limited) return limited;

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

  // RLS scopes these to the caller's company.
  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const segments = await getSessionTranscript(body.sessionId);

  // One mechanism — same generate+store the server-side finalize uses (§A21).
  const dissect = await runAndStoreDissect({
    companyId,
    actorId: auth.user.id,
    sessionId: body.sessionId,
    segments,
    sessionTitle: session.clientLabel ?? undefined,
    context: session.context,
  });

  return NextResponse.json({ dissect });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data } = await supabase
    .from("events")
    .select("payload")
    .eq("kind", "coach.dissect_generated")
    .eq("subject", `sales_session:${sessionId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.payload) {
    return NextResponse.json({ dissect: null });
  }
  const p = data.payload as Record<string, unknown>;
  return NextResponse.json({
    dissect: {
      hasSignal: true,
      strengths: Array.isArray(p.strengths) ? p.strengths : [],
      growthAreas: Array.isArray(p.growth_areas) ? p.growth_areas : [],
      standoutStrategy:
        p.standout_strategy && typeof p.standout_strategy === "object"
          ? p.standout_strategy
          : null,
      overall: typeof p.overall === "string" ? p.overall : undefined,
    },
  });
}
