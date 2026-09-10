import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { callerCompanyId } from "@/lib/api/callerCompanyId";
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
 *
 * REACHABLE FROM A PHONE (2026-09-11). This was cookie-only: `createClient()` for identity,
 * `getCurrentCompanyId()` for the company, and two reads that resolved their own client. A phone sends a
 * Bearer token and no cookies, so it got 401 - and the app therefore had no way to ask for a read again.
 *
 * That mattered as soon as the app started SAYING a read had failed. The sessions list now shows "Read
 * didn't finish" on a call where the coach came back blank or unreadable, and a chip that names a problem
 * with no way to act on it is worse than no chip: it tells a rep something is broken and leaves them
 * holding it. This is the other half of that chip.
 *
 * The scoped client is passed THROUGH to both reads, not just used for auth - the F22/F33 shape, which
 * has cost this codebase five separate defects: scoped for identity, anonymous for the read.
 */
const BodySchema = z.object({ sessionId: z.string().uuid() });

// LLM route: longer serverless budget than Vercel's short default (awaits an LLM call via a lib helper).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-sales-dissect",
    windowMs: 60_000,
    max: 12,
  });
  if (limited) return limited;

  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = await callerCompanyId(supabase, auth.user.id);
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  // RLS scopes these to the caller's company - which only holds if the caller's OWN client does the
  // reading. Passing `supabase` through is the whole point: resolving a scoped client and then reading
  // without it is the defect this route's docblock names.
  const session = await getSession(body.sessionId, supabase);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const segments = await getSessionTranscript(body.sessionId, supabase);

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
  // Same as POST: a phone reading back its own stored dissect must not read as anonymous.
  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // Owner-or-manager gate BEFORE the events readback. `events` RLS is company-wide
  // (0004/0103), so filtering by subject alone would let a same-company PEER rep read
  // another rep's private dissect (IDOR). getSession is RLS-scoped to owner-or-manager
  // (0083/0084) — a null result means the caller may not read this session's coaching
  // artifacts. Mirrors this route's own POST gate.
  // Through the CALLER'''s client, so the RLS that IS this gate applies to the caller. Resolving a scoped
  // client and then gating with an anonymous read would 404 every phone caller AND weaken the check to
  // whatever an anonymous session can see - the exact shape that cost five defects elsewhere.
  const session = await getSession(sessionId, supabase);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
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
