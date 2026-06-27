import "server-only";
import { liveSalesCue } from "@/lib/claude";
import type { TranscriptSegment, CueMode, SalesContext } from "@/lib/data/salesCoach";
import {
  buildLiveCueSystemPrompt,
  buildLiveCueUserMessage,
} from "./liveCuePrompt";

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

export type LiveCueResult = {
  shouldCue: boolean;
  mode: CueMode;
  cue: string;
};

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
}): Promise<LiveCueResult> {
  const silent: LiveCueResult = { shouldCue: false, mode: args.mode, cue: "" };
  try {
    if (args.segments.length < MIN_SEGMENTS) return silent;
    const recentSegments = args.segments.slice(-ROLLING_WINDOW);

    let systemPrompt = buildLiveCueSystemPrompt(args.mode);
    if (args.force) {
      systemPrompt +=
        "\n\nIMPORTANT: The agent has EXPLICITLY asked for help right now. " +
        "You MUST return shouldCue:true with ONE concrete, specific suggestion " +
        "for this exact moment in the conversation. Do not stay silent and do " +
        "not return an empty cue — give your single best move.";
    }
    const userMessage = buildLiveCueUserMessage({
      context: args.context,
      recentSegments,
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

    const cue = typeof o.cue === "string" ? o.cue.trim() : "";
    // Honour the understanding gate: an empty cue means stay silent,
    // regardless of what shouldCue claims. When forced (on-demand), any
    // non-empty cue counts — the agent asked.
    const shouldCue = args.force
      ? cue.length > 0
      : o.shouldCue === true && cue.length > 0;
    return { shouldCue, mode: args.mode, cue: shouldCue ? cue : "" };
  } catch {
    return silent;
  }
}
