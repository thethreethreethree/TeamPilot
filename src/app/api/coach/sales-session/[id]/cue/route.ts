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
} from "@/lib/data/salesCoach";
import { generateLiveCue } from "@/lib/coach/v5/liveCue";

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
