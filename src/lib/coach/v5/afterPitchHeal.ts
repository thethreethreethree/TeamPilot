/**
 * Should the After-Pitch page (re-)generate the summary when it loads a stored one?
 *
 * TRUE when there is no stored summary, no composite signal, OR — the case the 2026-08-13 audit
 * caught — a BLANK narrative that the composite `hasSignal` masked.
 *
 * The composite gate in `afterPitch.ts` is `narrative.hasSignal || moments || scores || cueLoop`.
 * The scores are DETERMINISTIC (computeTalkRatio / computeQuestionRate run without the LLM) and
 * `computeQuestionRate` returns a category for ANY session with ≥1 agent turn. So a session whose
 * "Your read" narrative came back blank — a reasoning-starved or errored read — still stored
 * `hasSignal:true` because scores were present, and the auto-heal (which keyed on the composite)
 * NEVER re-fired: the read stayed permanently blank while the composite claimed signal. That is the
 * INV22 "error dressed as no-data" class surviving at the UI layer, which is exactly what the token-
 * budget fix was meant to kill. Keying the heal on the NARRATIVE specifically recovers it.
 *
 * This is targeted, not wasteful: scores-present ⟺ agent-turns-present, so a call with real agent
 * turns that produced NO narrative can only be a starved/errored read. The genuine-thin case (no
 * agent turns) has no scores → the composite is already false → the first clause handles it, so we
 * never re-heal a legitimately empty debrief in a loop.
 *
 * Structural (no React), so the page effect and the regression test share one source of truth.
 */
export function afterPitchNeedsHeal(
  existing: { hasSignal: boolean; narrative: { hasSignal: boolean } } | null
): boolean {
  return !existing || !existing.hasSignal || !existing.narrative.hasSignal;
}
