# REMEDIATE — read-starvation fix audit remediation

## F1 — blank read masked by the composite hasSignal
Root cause: the after-pitch summary's composite `hasSignal` (afterPitch.ts:160) is an OR over
`narrative.hasSignal || moments || scores || cueLoop`. `computeQuestionRate`/`computeTalkRatio` are
deterministic (no LLM) and yield a score category for any session with ≥1 agent turn, so a session
whose LLM narrative came back BLANK still stored `hasSignal:true`. The auto-heal effect keyed on that
composite (`!existing.hasSignal`), so it never re-fired for a blank read; the empty-state Rebuild
branch keyed on it too, so no manual rebuild showed either — the read stayed permanently blank while
the composite claimed signal. This is the INV22 "error-dressed-as-no-data" class at the UI, and it is
why "hard-refresh → the read fills in" did NOT work for an already-stored blank read.
Remediation: extract the heal decision into a pure `afterPitchNeedsHeal(existing)`
(`src/lib/coach/v5/afterPitchHeal.ts`) that returns true when there is no summary, no composite
signal, OR `!existing.narrative.hasSignal`; the effect calls it. Targeted (not a loop on thin calls):
scores-present ⟺ agent-turns-present, so blank-narrative-with-scores can only be a starved read, and
the genuine-thin case (no turns → no scores → composite false) is caught identically by the first
clause. Bounded once-per-mount by the existing `autoGenAttemptedFor` ref; a successful re-gen stores a
real narrative → no further heal. Regression-locked (afterPitchHeal.test.ts) with the masked-blank case
as a detection test. class: error-dressed-as-no-data. severity: high. Fixed.

## F2 — stream path dropped finish_reason:length
Root cause: `parseSseDeltas` typed `choices[0].finish_reason` but only yielded `delta.content`, so a
reasoning-starved STREAMING response (suggest/copilot/formulate/briefing) truncated with no log — the
`finish_reason:"length"` warning existed only on the non-stream `call` path.
Remediation: track `finishReason` and `sawContent` across the SSE stream; in the generator's `finally`,
when `finishReason === "length"` emit a `console.error` (EMPTY vs TRUNCATED, model, budget) mirroring
the call path. `stream()` passes `{ model, budget: withReasoningHeadroom(args.maxTokens) }`. Every
content delta still yields (visibility added, streaming behaviour unchanged). Locked by 3 stream-path
tests (empty→log, truncated→log TRUNCATED, stop→no log). class: silent-starvation. severity: medium.
Fixed.

## Accepted (not fixed)
F3 (LOW): the 8000 clamp caps reasoning room; a corpus ~3× the calibration re-starves and raising the
7000 constant buys nothing (it clamps under the 8192 model limit). Ops-visible on both paths now; the
real fix for scale is corpus/prompt-size reduction (founder-gated), and the F1 heal makes a future
re-starvation self-recover on next view. No code change — flagged to the founder.
