/**
 * Should the After-Pitch page (re-)generate the summary when it loads a stored one?
 *
 * TRUE when there is no stored summary, no composite signal, OR — the case the 2026-08-13 audit
 * caught — a blank narrative that IS RECOVERABLE.
 *
 * The composite gate in `afterPitch.ts` is `narrative.hasSignal || moments || scores || cueLoop`. A blank
 * "Your read" (narrative.hasSignal:false) can happen two very different ways, and only ONE is recoverable:
 *
 *  1. STARVED (recoverable): the session HAS agent turns, so the review engine SHOULD produce a read, but the
 *     reasoning model came back empty. Re-generating (now with the 7000-token headroom) fills it in. Here the
 *     deterministic scores are PRESENT (`computeQuestionRate`/`computeTalkRatio` return categories whenever
 *     there is ≥1 agent turn — `salesScore` returns EMPTY only when `agentSegments < MIN_AGENT_SEGMENTS`).
 *
 *  2. STRUCTURALLY BLANK (NOT recoverable): a one-sided / customer-only recording (rep mic not captured → 0
 *     agent turns). `salesReview` short-circuits to EMPTY_REVIEW *deterministically, with no LLM*, so the
 *     narrative can NEVER become non-blank no matter how many times we re-run. But `moments` (gated on
 *     MIN_SEGMENTS=1 counting ANY speaker) and `cueLoop` (live cues, transcript-independent) can still make
 *     the composite `hasSignal` true. Healing on `!narrative.hasSignal` alone would therefore re-fire a full
 *     4-engine generation on EVERY page mount and NEVER converge — unbounded LLM spend for a read that is
 *     correctly blank. (Regression introduced 2026-08-13, caught by adversarial review before it was noticed.)
 *
 * So the heal keys the narrative clause on `scores.length > 0` — an EXACT proxy for "agent turns present",
 * which is precisely the recoverable case (1) and excludes the non-converging case (2). Case (2)'s summary is
 * still shown (its moments/scores/cueLoop render); it just isn't pointlessly regenerated.
 *
 * Structural (no React), so the page effect and the regression test share one source of truth.
 */
export function afterPitchNeedsHeal(
  existing:
    | { hasSignal: boolean; narrative: { hasSignal: boolean }; scores: unknown[] }
    | null
): boolean {
  if (!existing) return true; // nothing stored → generate
  if (!existing.hasSignal) return true; // no composite signal at all → (re)generate; cheap when truly empty
  // A blank read is worth healing ONLY when agent turns exist (scores present) → it's a STARVED read that
  // should recover. Scores-empty + blank narrative = a one-sided recording whose read is correctly blank and
  // can never regenerate; healing it would loop forever.
  if (!existing.narrative.hasSignal && existing.scores.length > 0) return true;
  return false;
}
