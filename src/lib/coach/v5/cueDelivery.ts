import type { CueImportance } from "./cueInstrument";

export type CueDeliveryDecision = { deliver: boolean; suppressReason?: string };

/**
 * Should this generated cue actually reach the rep's ear? (Delivery gate — "the
 * single best cue", founder 2026-07-06; §3.3 never over-cue.) The cue ENGINE has
 * already applied the §3.2 understanding gate (shouldCue) AND the client's
 * pre-fetch cooldown has already passed. This is the second filter that keeps
 * the delivered stream to what genuinely MATTERS, so the rep never learns to
 * tune the coach out:
 *   - on-demand (the rep pressed "coach me now") → always deliver a non-empty cue.
 *   - shouldCue false / empty cue → nothing to say.
 *   - "low" importance → SUPPRESS (a marginal cue dilutes the signal).
 *   - "medium" / "high" → deliver.
 *
 * NOTE (A4 — a §4-measured refinement, deliberately NOT built here): letting a
 * "high" cue jump the pre-fetch cooldown trades LLM cost for lower latency on
 * pivotal moments. That threshold is answered by the live readout, not pre-decided.
 *
 * Pure + dependency-free so the gate is regression-pinned and the hook can't
 * silently drift back to "deliver every cue".
 */
export function decideCueDelivery(args: {
  shouldCue: boolean;
  hasCue: boolean;
  importance: CueImportance;
  onDemand: boolean;
}): CueDeliveryDecision {
  if (args.onDemand) {
    return args.hasCue
      ? { deliver: true }
      : { deliver: false, suppressReason: "empty" };
  }
  if (!args.shouldCue || !args.hasCue) {
    return { deliver: false, suppressReason: "gate" };
  }
  if (args.importance === "low") {
    return { deliver: false, suppressReason: "low-importance" };
  }
  return { deliver: true };
}
