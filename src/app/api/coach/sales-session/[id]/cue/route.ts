import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  getSession,
  getSessionTranscript,
  appendCue,
  getAgentCoachStart,
} from "@/lib/data/salesCoach";
import { generateLiveCue } from "@/lib/coach/v5/liveCue";
import { getExperienceMode } from "@/lib/experience/mode";
// Spec 4.3a: the AI LISTENS for a rep's first days on the coach, then starts
// advising. The window boundary is a pure, unit-tested function (observeWindow.ts)
// so an off-by-one can't fire cues a day early or suppress them a day late.
import { isWithinObserveWindow, observeWindowEndsAt } from "@/lib/coach/v5/observeWindow";

/**
 * Live Sales Coach — generate a live cue for a session (Phase B brain).
 *
 * Reads the session's recent transcript, runs the §3.3 understanding
 * gate, and returns a short cue in the requested mode (or stays silent).
 * When it cues, it records the cue (append-only) so the cue-reliance
 * progress signal (§3.5) can be derived later.
 *
 * NOTE: this is the cue BRAIN. The audio I/O around it — getting the
 * live transcript in and speaking the cue privately to the earpiece —
 * is subsystem 1 (vendor-gated, not built). The realtime pipeline will
 * call this and TTS the returned cue.
 */

const BodySchema = z.object({
  mode: z.enum(["suggestion", "guide_response"]),
  // force: the agent explicitly asked ("coach me now") — bypass the
  // understanding gate and always return a concrete suggestion.
  force: z.boolean().optional(),
  // stall: the client's silence timer fired (a long quiet with no new
  // speech). The brain still decides — a post-close silence stays sacred.
  stall: z.boolean().optional(),
  // stress (build 3): MEASURED signals on the rep's latest turn — filler
  // density and/or a pace spike vs their baseline. A hint; the brain decides.
  stress: z
    .object({
      fillerSpike: z.boolean(),
      paceSpike: z.boolean(),
    })
    .optional(),
  // Option 3 (build): the rep's signal-based confidence read, as a HINT.
  confidence: z.enum(["steady", "wavering", "unsteady"]).optional(),
  // S1b realtime: an inline rolling transcript from the live websocket.
  // When present, the brain reads it directly — skipping the DB round
  // trip that would add latency on the hot path ("a late tip is
  // worthless"). When absent, falls back to the stored transcript.
  liveTranscript: z
    .array(
      z.object({
        speaker: z.enum(["agent", "customer", "unknown"]),
        text: z.string().min(1).max(8000),
      })
    )
    .max(200)
    .optional(),
});

// LLM route: longer serverless budget than Vercel's short default (awaits an LLM call via a lib helper).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Cues are frequent during a live call — generous limit, abuse guard.
  const limited = rateLimit(req, {
    id: "sales-session-cue",
    windowMs: 60_000,
    max: 120,
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
  // Owner-only: appendCue below writes to coaching_cues via the SERVICE-ROLE client (bypasses RLS),
  // and getSession is company-scoped (owner OR any same-company manager, per the 0084 policy). Without
  // this check a colleague could POST to another rep's session and inject cue rows — inflating that
  // rep's cue-reliance count and bending the "training wheels come off" progress trend the coach grades
  // itself against. Mirrors the identical guard on cue-outcome + segments (the 0082 A18 integrity class).
  if (session.agentId !== auth.user.id) {
    return NextResponse.json(
      { error: "Only the session's rep can generate its cues." },
      { status: 403 }
    );
  }

  // ── 3-day silent-observe (spec 4.3a), Standard only ──────────────────────
  // For a rep's first 3 days on the coach, the AI listens: the call is still
  // recorded and reviewed (the after-pitch), but no PROACTIVE in-ear cue fires —
  // advice starts on day 4. A FORCED on-demand cue ("coach me now") is still
  // honored, because the rep explicitly asked (§3.3 rep-controlled); only the
  // AI's own auto-cues wait. Expert is unaffected — immediate cues, as today.
  // [FLAGGED to founder: "listens for 3 days" is read as "no PROACTIVE advice,
  //  but the rep can still pull help on demand". If you want the window to also
  //  silence on-demand requests, drop the `!body.force` guard.]
  if (!body.force) {
    // Order matters for cost (audit F2, 2026-07-15): check the WINDOW first. Once a
    // rep is past their first 3 days — which is almost every cue, forever — this is
    // one indexed read and we skip the mode lookup entirely. Only a rep still inside
    // the window pays for the second read (to confirm it's Standard, since Expert is
    // never observed). Behaviour is identical to reading mode first.
    const startedAt = await getAgentCoachStart(session.agentId);
    if (isWithinObserveWindow(startedAt, Date.now())) {
      const mode = await getExperienceMode(supabase, auth.user.id);
      if (mode === "standard") {
        return NextResponse.json({
          cue: {
            shouldCue: false,
            mode: body.mode,
            cue: "",
            phase: "unknown",
            trigger: "none",
            importance: "low",
          },
          cueId: null,
          observing: true,
          observeUntil: observeWindowEndsAt(startedAt),
        });
      }
    }
  }

  // Prefer the inline live transcript (S1b, low-latency); else read the
  // stored transcript. generateLiveCue only reads .speaker + .text, so
  // a minimal shape suffices for the inline path.
  const segments = body.liveTranscript
    ? body.liveTranscript.map((s, i) => ({
        id: `live-${i}`,
        sessionId: id,
        speaker: s.speaker,
        text: s.text,
        seq: i,
        spokenAt: null,
      }))
    : await getSessionTranscript(id);

  const result = await generateLiveCue({
    companyId,
    // Grounds the cue in THIS rep's own proven lines (§A8 growth-participant).
    agentId: session.agentId,
    mode: body.mode,
    context: session.context,
    segments,
    force: body.force,
    stalled: body.stall,
    stress: body.stress,
    confidenceLevel: body.confidence,
  });

  // Record only delivered cues (append-only). A "stay silent" decision
  // is not a cue and is not recorded.
  //
  // KNOWN CONFLATION (audit F4, 2026-06-27, DEFERRED): a forced on-demand
  // cue (body.force, "coach me now") is recorded identically to an
  // auto-cue, so the §3.5 cue-reliance signal counts agent-initiated help
  // requests together with passive auto-cues. Proper fix = an `on_demand`
  // boolean column on coaching_cues so getCueRelianceSeries can separate
  // them. Deferred to avoid a migration-ordering window during live
  // debugging; do the migration when ready.
  let cueId: string | null = null;
  if (result.shouldCue) {
    const appended = await appendCue({
      sessionId: id,
      mode: result.mode,
      text: result.cue,
      // F1 (§4/§1.1) — persist WHY it fired, for build-4 validation.
      trigger: result.trigger,
      signal: body.stress ?? null,
    });
    // Return the persisted cue id so the client can record a rep_marked
    // "used it" outcome against THIS cue (After Pitch Summary cue loop, 0080).
    cueId = appended?.id ?? null;
  }

  return NextResponse.json({ cue: result, cueId });
}
