import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getSession, appendCue } from "@/lib/data/salesCoach";
import { liveMeetingCue } from "@/lib/claude";
import { selectStrategy } from "@/lib/coach/strategy/selectStrategy";
import { resolveCoachingMode } from "@/lib/coach/strategy/resolveCoachingMode";
import { toCoachingCuesMode } from "@/lib/coach/strategy/persistCueMode";
import type { CueLLM, StrategyTranscriptSegment } from "@/lib/coach/strategy/coachingStrategy";

/**
 * Live MEETING / HUDDLE cue (Meeting Coach / Team-Sync). Sibling of the sales `/sales-session/[id]/cue` route,
 * re-aimed at facilitation: it resolves the session's `session_kind` (migration 0237) → a CoachingMode, picks
 * the meeting/huddle strategy (`selectStrategy`), and runs it over the rolling meeting transcript with
 * `liveMeetingCue` injected as the LLM. Deliberately re-uses the sales session/cue INFRASTRUCTURE
 * (coaching_sessions, coaching_cues, the owner gate) — a meeting session IS a coaching_sessions row.
 *
 * DIFFERENCES from the sales route (all founder decisions 2026-08-21): NO 3-day observe window (meeting cues run
 * live from day 1, controlExempt); N-party transcript (speaker is a participant string, not the 2-party enum);
 * and the persist maps the generalized cue mode `directive → guide_response` because coaching_cues.mode is
 * CHECK('suggestion','guide_response') (0070) and would reject 'directive' at INSERT.
 */
const BodySchema = z.object({
  // Generalized cue mode: 'suggestion' = name the facilitation move; 'directive' = the exact words to say.
  mode: z.enum(["suggestion", "directive"]),
  // The facilitator explicitly asked ("coach me now") — bypass the understanding gate.
  force: z.boolean().optional(),
  // The meeting appears near its end — enables the summarize/wrap cue. Nothing computes this server-side yet;
  // the client passes it (session elapsed vs. a scheduled duration, or a "wrap up" control).
  nearingEnd: z.boolean().optional(),
  // The rolling live meeting transcript (N-party: speaker is a participant id/name from the attribution source).
  liveTranscript: z
    .array(
      z.object({
        speaker: z.string().min(1).max(120),
        text: z.string().min(1).max(8000),
      })
    )
    .max(200)
    .optional(),
});

// LLM route: longer serverless budget than Vercel's short default (awaits an LLM call).
export const maxDuration = 60;

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "meeting-session-cue", windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  }

  // Owner-only: appendCue writes coaching_cues via the SERVICE-ROLE client (bypasses RLS), and getSession is
  // company-scoped (owner OR any same-company manager, 0084). Without this a colleague could inject cue rows
  // into another facilitator's meeting. Mirrors the sales cue route's identical guard (0082 A18 integrity).
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's facilitator can generate its cues." },
      { status: 403 }
    );
  }

  // This route serves MEETING/HUDDLE sessions only — a sales session uses /sales-session/[id]/cue (which
  // carries the sales brain + the observe window). Guard so a mis-routed sales session can't run the meeting brain.
  const mode = resolveCoachingMode(session.sessionKind);
  if (mode === "sales") {
    return NextResponse.json(
      { error: "This session is not a meeting or huddle." },
      { status: 400 }
    );
  }

  const segments: StrategyTranscriptSegment[] = (body.liveTranscript ?? []).map((s, i) => ({
    speaker: s.speaker,
    text: s.text,
    seq: i,
  }));

  // Inject liveMeetingCue as the strategy's LLM, binding this session's company for grounding + the control gate.
  const cueLLM: CueLLM = (a) => liveMeetingCue({ ...a, companyId });
  const strategy = selectStrategy(mode, { cueLLM });

  let decision;
  const analyzeStart = Date.now();
  try {
    decision = await strategy.analyze(segments, {
      sessionKind: session.sessionKind,
      companyId,
      mode: body.mode,
      force: body.force,
      signals: { nearingEnd: body.nearingEnd === true },
    });
  } catch (err) {
    // The strategy never throws (it resolves to silent), but guard the route boundary too — surface a forced
    // failure honestly rather than a false "nothing to add".
    console.error("[coach/meeting-cue] cue failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Coach couldn't respond right now." }, { status: 502 });
  }

  // Record only delivered cues (append-only). Map the generalized mode to the coaching_cues CHECK vocabulary
  // ('suggestion'|'guide_response') so a 'directive' cue doesn't violate the constraint at INSERT.
  let cueId: string | null = null;
  if (decision.shouldCue && decision.cue) {
    const appended = await appendCue({
      sessionId: id,
      // Map the generalized cue mode to the coaching_cues CHECK vocabulary (the Step-5 landmine) via the single
      // pure chokepoint, so a 'directive' cue can never violate the constraint at INSERT.
      mode: toCoachingCuesMode(body.mode),
      text: decision.cue,
      // A late tip is worthless — persist the analyze round-trip so Dissect can see delivery latency.
      latencyMs: Date.now() - analyzeStart,
      trigger: decision.trigger,
      signal: null,
    });
    cueId = appended?.id ?? null;
  }

  return NextResponse.json({ cue: decision, cueId });
}
