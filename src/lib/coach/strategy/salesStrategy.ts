import "server-only";
import { generateLiveCue } from "@/lib/coach/v5/liveCue";
import type { TranscriptSegment, TranscriptSpeaker, SalesContext } from "@/lib/data/salesCoach";
import type {
  CoachingStrategy,
  CoachingContext,
  CueDecision,
  StrategyTranscriptSegment,
} from "./coachingStrategy";

/**
 * SalesStrategy — the EXISTING sales cue brain, expressed as a CoachingStrategy.
 *
 * ┌─ STATUS: PROPOSED SEAM · NOT YET WIRED ─────────────────────────────────────────────┐
 * │ Phase-2 step-2 of docs/MeetingCoach-BuildPlan.md: "refactor the existing sales logic  │
 * │ to IMPLEMENT the interface, unchanged in behavior." This adapter does NOT change the   │
 * │ live path — the engine still calls generateLiveCue directly. It exists to PROVE the    │
 * │ CoachingStrategy contract can wrap the real sales engine before we take the risk of     │
 * │ re-pointing the live loop at it (step 3, held until the reuse map is confirmed). It is  │
 * │ a pure adapter over the shipped, unchanged generateLiveCue — behavior is identical by   │
 * │ construction. Wiring + a regression test that Sales Coach behaves identically THROUGH   │
 * │ this adapter is step 3.                                                                 │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Writing this adapter against the REAL generateLiveCue signature (not a synthetic) surfaced two
 * design findings, both now recorded:
 *  1. CoachingContext needed `companyId` (+ optional `wearerId`) — generateLiveCue can't ground a cue
 *     without the company. The interface was corrected (see coachingStrategy.ts).
 *  2. generateLiveCue's `segments` param is typed as the full DB-row `TranscriptSegment` (with `id` +
 *     `sessionId`), but it only READS `speaker/text/seq`. A strategy input has no DB ids. So the seam
 *     wiring (step 3) should narrow that param to `Pick<TranscriptSegment,"speaker"|"text"|"seq"|"spokenAt">`.
 *     Until then this adapter fills the unused id/sessionId with empty strings (they are never read — the
 *     window is sliced and handed to the prompt builder, which reads content only). Flagged, not hidden.
 */

/** Narrow a generalized (N-party) speaker back to the sales 2-party enum. */
function toSalesSpeaker(speaker: string): TranscriptSpeaker {
  return speaker === "agent" || speaker === "customer" ? speaker : "unknown";
}

export class SalesStrategy implements CoachingStrategy {
  readonly kind = "sales";

  async analyze(
    segments: StrategyTranscriptSegment[],
    context: CoachingContext
  ): Promise<CueDecision> {
    // Finding #2: generateLiveCue reads only speaker/text/seq; id/sessionId are unused here (see header).
    const salesSegments: TranscriptSegment[] = segments.map((s) => ({
      id: "",
      sessionId: "",
      speaker: toSalesSpeaker(s.speaker),
      text: s.text,
      seq: s.seq,
      spokenAt: s.spokenAt ?? null,
    }));

    // Strategy-specific hints ride in the open `signals` bag; the sales strategy reads its own keys and
    // ignores anything malformed (a bad hint → no hint, never a guess — §3.2). Both hints are VALIDATED,
    // not cast: a wrong-shaped `stress` must not reach the brain as a real signal.
    const rawStress = context.signals?.["stress"];
    const stress =
      rawStress !== null &&
      typeof rawStress === "object" &&
      typeof (rawStress as { fillerSpike?: unknown }).fillerSpike === "boolean" &&
      typeof (rawStress as { paceSpike?: unknown }).paceSpike === "boolean"
        ? (rawStress as { fillerSpike: boolean; paceSpike: boolean })
        : undefined;
    const rawConfidence = context.signals?.["confidence"];
    const confidenceLevel =
      rawConfidence === "steady" || rawConfidence === "wavering" || rawConfidence === "unsteady"
        ? rawConfidence
        : undefined;

    // sessionKind for the sales strategy is one of SalesContext ('in_person'|'video'); anything else
    // (a future 'meeting'/'huddle') is not this strategy's concern — default to in_person framing.
    const salesContext: SalesContext = context.sessionKind === "video" ? "video" : "in_person";

    const result = await generateLiveCue({
      companyId: context.companyId,
      agentId: context.wearerId,
      // The generalized 'directive' maps to the sales 'guide_response' (exact-words mode).
      mode: context.mode === "directive" ? "guide_response" : "suggestion",
      context: salesContext,
      segments: salesSegments,
      force: context.force,
      stalled: context.stall,
      stress,
      confidenceLevel,
    });

    return {
      shouldCue: result.shouldCue,
      cue: result.cue || null,
      trigger: result.trigger,
      phase: result.phase,
      importance: result.importance,
    };
  }
}
