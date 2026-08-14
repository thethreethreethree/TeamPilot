import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { generateSalesReview } from "@/lib/coach/v5/salesReview";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/review
 *
 * Generate the post-call growth review for a Live Sales Coach session
 * (subsystem 3 — the growth engine). Obeys the tone law (strengths
 * first, then growth-as-opportunity). Stores the result as an
 * append-only chain event (coach.sales_review_generated), the same
 * mechanism Coach v5 debriefs use (§A21, §3.1).
 *
 * Two input modes:
 *   - { sessionId } — load the stored diarized transcript and review it.
 *   - { segments }  — review an inline transcript directly. This is how
 *     the engine is exercised + verified BEFORE the realtime audio
 *     pipeline (subsystem 1) exists to populate sessions.
 *
 * Non-blocking by contract elsewhere, but here it's the primary action,
 * so failures surface as the honest empty state (hasSignal:false), never
 * a fabricated review.
 */

const InlineSegment = z.object({
  speaker: z.enum(["agent", "customer", "unknown"]),
  // Cap per-segment text (matches the 8000 cap on the label-transcript sibling that stores the same
  // data). Without it, all 2000 array slots could each carry a multi-MB string straight into the LLM
  // prompt (maxDuration=60) — attacker-controlled model spend + worker occupancy at 20 req/min.
  text: z.string().min(1).max(8000),
});

const BodySchema = z.union([
  z.object({ sessionId: z.string().uuid() }),
  z.object({
    segments: z.array(InlineSegment).min(1).max(2000),
    sessionTitle: z.string().max(200).optional(),
    context: z.enum(["in_person", "video"]).optional(),
  }),
]);

// LLM route: longer serverless budget than Vercel's short default (awaits an LLM call via a lib helper).
// Raised 60→300 (2026-08-14): a growth review over a long call's transcript can run past 60s and get killed at
// the ceiling → a 504. 300s is the Pro plan max (the STT routes already use it).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-sales-review",
    windowMs: 60_000,
    max: 20,
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

  let segments: TranscriptSegment[];
  let sessionTitle: string | undefined;
  let context: "in_person" | "video" | undefined;
  let subject: string;

  if ("sessionId" in body) {
    // RLS scopes getSession/getSessionTranscript to the caller's company,
    // so a user can only review sessions they're allowed to read.
    const session = await getSession(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or not accessible." },
        { status: 404 }
      );
    }
    segments = await getSessionTranscript(body.sessionId);
    sessionTitle = session.clientLabel ?? undefined;
    context = session.context;
    subject = `sales_session:${body.sessionId}`;
  } else {
    // Inline transcript: synthesise minimal segments for the engine
    // (it reads speaker + text only). Used to verify the tone law on a
    // sample transcript before the realtime pipeline exists.
    segments = body.segments.map((s, i) => ({
      id: `inline-${i}`,
      sessionId: "inline",
      speaker: s.speaker,
      text: s.text,
      seq: i,
      spokenAt: null,
    }));
    sessionTitle = body.sessionTitle;
    context = body.context;
    subject = "sales_session:adhoc";
  }

  const review = await generateSalesReview({
    companyId,
    sessionTitle,
    context,
    segments,
  });

  // Append-only chain record (§3.1 + §3.6). Best-effort — the review
  // still returns even if the event insert fails. Stores the structured
  // review so a future surface reads it back without re-spending an LLM
  // call. Only stored for real sessions, not adhoc test transcripts.
  if (review.hasSignal && "sessionId" in body) {
    try {
      await supabase.from("events").insert({
        company_id: companyId,
        actor: auth.user.id,
        kind: "coach.sales_review_generated",
        subject,
        payload: {
          strengths_count: review.strengths.length,
          growth_count: review.growthAreas.length,
          strengths: review.strengths,
          growth_areas: review.growthAreas,
          closing: review.closing ?? null,
          coach_version: "sales-v1",
        },
      });
    } catch {
      /* event emit is best-effort; the review still returns */
    }
  }

  return NextResponse.json({ review });
}

/**
 * GET /api/coach/sales-session/review?sessionId=…
 *
 * Read back the most recent stored review for a session without
 * regenerating (no LLM cost).
 */
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
    .eq("kind", "coach.sales_review_generated")
    .eq("subject", `sales_session:${sessionId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.payload) {
    return NextResponse.json({ review: null });
  }
  const p = data.payload as Record<string, unknown>;
  return NextResponse.json({
    review: {
      hasSignal: true,
      strengths: Array.isArray(p.strengths) ? p.strengths : [],
      growthAreas: Array.isArray(p.growth_areas) ? p.growth_areas : [],
      closing: typeof p.closing === "string" ? p.closing : undefined,
    },
  });
}
