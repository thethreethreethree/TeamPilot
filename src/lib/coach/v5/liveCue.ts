import "server-only";
import { liveSalesCue } from "@/lib/claude";
import type { TranscriptSegment, CueMode, SalesContext } from "@/lib/data/salesCoach";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import {
  buildLiveCueSystemPrompt,
  buildLiveCueUserMessage,
  type CueGrounding,
} from "./liveCuePrompt";

// Compact company grounding for live cues, CACHED per company so it costs no
// per-cue DB round-trip (founder 2026-07-06 — the compact + cached approach, so
// helpfulness improves without adding to the response time). 5-min TTL covers a
// session's worth of cues after a single fetch; corpus changes rarely.
const CUE_GROUNDING_TTL_MS = 5 * 60 * 1000;
const cueGroundingCache = new Map<string, { g: CueGrounding; at: number }>();

async function getCueGrounding(companyId: string): Promise<CueGrounding> {
  const now = Date.now();
  const hit = cueGroundingCache.get(companyId);
  if (hit && now - hit.at < CUE_GROUNDING_TTL_MS) return hit.g;
  const [methodology, product] = await Promise.all([
    getCurrentSalesCorpus(companyId, "methodology").catch(() => null),
    getCurrentSalesCorpus(companyId, "product").catch(() => null),
  ]);
  // Compact — cues are latency-critical, so cap the injected text tightly.
  const g: CueGrounding = {
    methodology: methodology?.content?.trim().slice(0, 600) || null,
    product: product?.content?.trim().slice(0, 400) || null,
  };
  cueGroundingCache.set(companyId, { g, at: now });
  return g;
}

/**
 * Live Sales Coach — real-time cue engine (the coaching brain, minus the
 * vendor-bound audio I/O). Takes the rolling transcript + a mode and
 * decides whether to deliver a short cue, per the §3.3 understanding
 * gate. Never throws — a cue failure must never disrupt a live call; it
 * resolves to "stay silent".
 *
 * The audio pipeline (subsystem 1, vendor-gated) will call this with the
 * latest transcript window as words are transcribed, then TTS any
 * returned cue privately to the agent's earpiece + record it via
 * appendCue (for the cue-reliance signal).
 */

export type CuePhase =
  | "opener"
  | "small_talk"
  | "discovery"
  | "pitch"
  | "objection"
  | "close"
  | "stall"
  | "unknown";
export type CueTrigger =
  | "objection"
  | "buying_signal"
  | "filler_spike"
  | "pace_spike"
  | "stall"
  | "none";

export type LiveCueResult = {
  shouldCue: boolean;
  mode: CueMode;
  cue: string;
  // The coach's read of the moment (§3.2 understanding gate; §3.6 make it
  // visible). Present even when it stays silent.
  phase: CuePhase;
  trigger: CueTrigger;
};

const PHASES = new Set<string>([
  "opener",
  "small_talk",
  "discovery",
  "pitch",
  "objection",
  "close",
  "stall",
  "unknown",
]);
const TRIGGERS = new Set<string>([
  "objection",
  "buying_signal",
  "filler_spike",
  "pace_spike",
  "stall",
  "none",
]);

/** Only consider the most recent N segments — latency + relevance: the
 *  coach reacts to the live moment, not the whole call. */
const ROLLING_WINDOW = 12;
/** Need at least this much conversation to read the situation honestly. */
const MIN_SEGMENTS = 2;

export async function generateLiveCue(args: {
  companyId: string;
  mode: CueMode;
  context?: SalesContext;
  segments: TranscriptSegment[];
  /** force: the agent explicitly asked ("coach me now") — bypass the
   *  understanding gate and always return a concrete suggestion. */
  force?: boolean;
  /** The conversation has gone quiet for a while (a possible stall). */
  stalled?: boolean;
  /** MEASURED stress on the rep's latest turn (build 3) — filler density
   *  and/or a pace spike vs their baseline. The brain still decides. */
  stress?: { fillerSpike: boolean; paceSpike: boolean };
  /** Option 3 — the rep's signal-based confidence read, as a HINT. */
  confidenceLevel?: "steady" | "wavering" | "unsteady";
}): Promise<LiveCueResult> {
  const silent: LiveCueResult = {
    shouldCue: false,
    mode: args.mode,
    cue: "",
    phase: "unknown",
    trigger: "none",
  };
  try {
    if (args.segments.length < MIN_SEGMENTS) return silent;
    const recentSegments = args.segments.slice(-ROLLING_WINDOW);

    const grounding = await getCueGrounding(args.companyId);
    let systemPrompt = buildLiveCueSystemPrompt(args.mode, grounding);
    if (args.force) {
      // F1 (audit 2026-06-27): the agent asked, so always RESPOND — but
      // never FABRICATE. Honesty over a forced tip (§3.4/§5). Give a real
      // move if there is one; otherwise say so plainly.
      systemPrompt +=
        "\n\nThe agent has EXPLICITLY asked for help right now, so always " +
        "respond with one short line and set shouldCue:true. If there is a " +
        "clear high-value move, give your single best one. If the " +
        "conversation genuinely has no real coaching moment yet (small talk, " +
        "a mic check, nothing to work with), say that honestly instead — " +
        "e.g. 'Nothing jumping out yet — let them keep talking.' NEVER invent " +
        "a sales moment or coach on something that isn't actually there.";
    }
    const userMessage = buildLiveCueUserMessage({
      context: args.context,
      recentSegments,
      stalled: args.stalled,
      stress: args.stress,
      confidenceLevel: args.confidenceLevel,
    });

    const r = await liveSalesCue({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return silent;

    let raw: unknown;
    try {
      raw = JSON.parse(r.text);
    } catch {
      return silent;
    }
    if (typeof raw !== "object" || raw === null) return silent;
    const o = raw as Record<string, unknown>;

    const phase: CuePhase =
      typeof o.phase === "string" && PHASES.has(o.phase)
        ? (o.phase as CuePhase)
        : "unknown";
    const trigger: CueTrigger =
      typeof o.trigger === "string" && TRIGGERS.has(o.trigger)
        ? (o.trigger as CueTrigger)
        : "none";

    const cue = typeof o.cue === "string" ? o.cue.trim() : "";
    // Honour the understanding gate: an empty cue means stay silent,
    // regardless of what shouldCue claims. When forced (on-demand), any
    // non-empty cue counts — the agent asked.
    const shouldCue = args.force
      ? cue.length > 0
      : o.shouldCue === true && cue.length > 0;
    return {
      shouldCue,
      mode: args.mode,
      cue: shouldCue ? cue : "",
      phase,
      trigger,
    };
  } catch {
    return silent;
  }
}
