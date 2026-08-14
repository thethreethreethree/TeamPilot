/**
 * captureGap — the single source of truth for detecting a one-sided (capture-gap)
 * After-Pitch, and deciding when the automatic post-call re-transcribe should fire.
 *
 * A blank / thin read has two very different causes, and only ONE of them is fixable
 * by re-transcribing the saved audio:
 *   - "customer-missing": the customer side carries zero transcribed words, so
 *     computeTalkRatio emits its data-capture caveat (display "—", salesScore.ts).
 *     The agent side WAS captured (so scores are non-empty — length ≥ 2). This is the
 *     founder-reported 2026-08-14 case, and a clean offline re-diarization recovers
 *     the missing customer side. → auto-recover fires.
 *   - "agent-missing": zero agent turns, so the score engines return EMPTY and the
 *     whole summary has no signal. The existing whole-empty recovery / label path
 *     owns this; auto-recover (which keys on the talk_ratio caveat) does not.
 *   - null: a healthy two-sided call (or a genuinely thin one), where re-transcribing
 *     reproduces the same transcript and cannot help — e.g. a STARVED LLM read. The
 *     silent auto-heal owns that; offering re-transcribe there is a false diagnosis.
 *
 * NOTE this deliberately is NOT `scores.length === 0`: the customer-missing case still
 * has the two deterministic computed scores (talk_ratio caveat + question_rate), so a
 * length gate would wrongly classify the exact reported session as healthy.
 */

type ScoreLike = { key: string; caveat?: boolean };
export type SummaryLike = {
  narrative: { hasSignal: boolean };
  scores: ScoreLike[];
};

export type CaptureGap = "customer-missing" | "agent-missing" | null;

export function detectCaptureGap(summary: SummaryLike): CaptureGap {
  const talk = summary.scores.find((s) => s.key === "talk_ratio");
  if (talk?.caveat) return "customer-missing"; // custW === 0, agent present
  if (summary.scores.length === 0 && !summary.narrative.hasSignal) return "agent-missing";
  return null;
}

/**
 * Should the After-Pitch page auto-fire the SERVER re-transcribe on load? Only for the
 * customer-missing capture gap (the recoverable one) AND only when there's saved audio
 * to re-transcribe from. The at-most-once cost guard lives server-side (the
 * auto_recover_attempted_at marker) + a per-mount client latch; this predicate only
 * decides applicability, not idempotency.
 */
export function afterPitchNeedsAutoRecover(
  summary: SummaryLike | null,
  hasSavedRecording: boolean
): boolean {
  return !!summary && hasSavedRecording && detectCaptureGap(summary) === "customer-missing";
}
