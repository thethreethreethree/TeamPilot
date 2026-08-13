# CLOSURE — read-starvation fix audit remediation

## What shipped
The third adversarial review agent (of the "audit the recent build fully" request) audited the CORE
read-starvation fix. It confirmed the token-budget math sound + universally applied at the provider,
but found the defense-in-depth INERT for the exact incident it targets. Two real fixes:
- **F1 (HIGH):** the after-pitch auto-heal keyed on the COMPOSITE `hasSignal`, which deterministic
  scores keep true, so a BLANK "Your read" masked by present scores stored `hasSignal:true` and NEVER
  re-healed — the read stayed permanently blank while the composite claimed signal (INV22
  error-dressed-as-no-data, at the UI). This is also why my "hard-refresh fills it in" guidance failed
  for an already-stored blank read. Fixed by keying the heal on the NARRATIVE (`afterPitchNeedsHeal`,
  extracted + detection-tested).
- **F2 (MEDIUM):** the DeepSeek STREAM path dropped `finish_reason:"length"`, so a starved streaming
  engine (suggest/copilot/formulate/briefing) truncated silently — the same class the call-path log
  closed. Fixed by tracking + logging finish_reason on the stream (3 stream-path tests).
- **F3 (LOW, accepted):** the 8000 clamp caps reasoning room; raising the 7000 constant buys nothing;
  a corpus ~3× the calibration re-starves. Now ops-visible on both paths; the real fix for scale is
  corpus-trim (founder-gated), and F1 makes a future re-starvation self-heal on next view.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
Test Files 405 passed | 1 skipped (406); Tests 2799 passed | 15 skipped (2814)
```
New: afterPitchHeal.test.ts (4, detection-tested masked-blank case) + deepseek stream-path (3).

## Residual (A36)
```json
[
  { "id": "R1", "item": "The after-pitch mount effect that consumes afterPitchNeedsHeal is a React client effect, not node-exercisable; only the pure predicate + the provider stream log are unit-tested. The heal's RUNTIME behavior (re-gen POSTs, fills the read) is confirmed by trace + the founder's live check.", "why_skipped": "No browser/React harness in the sandbox (standing posture). The DECISION is now a pure tested helper; the effect is a thin call over it.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T22:45:00Z", "outcome": "Opened + assessed: predicate detection-tested; live-confirm on the founder's next revisit of a blank-read session." },
  { "id": "R2", "item": "F3 corpus-scale re-starvation is unfixed (accepted): a corpus ~3× the calibration re-starves regardless of headroom. Now logged on both paths; F1 self-heals it on next view.", "why_skipped": "The real fix is corpus/prompt-size reduction — a founder-gated decision (corpus-trim), not more headroom (which clamps).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T22:46:00Z", "outcome": "Flagged to founder in the action queue; awaiting the corpus-trim decision." }
]
```

## Un-named reliance
- F1 relies on `generate()` PERSISTING the re-generated summary (via the after-pitch route) so a
  successful heal stores a real narrative and stops re-firing — it does (route stores on composite
  hasSignal, which a real narrative satisfies). It also relies on scores-present ⟺ agent-turns-present
  (salesScore.computeQuestionRate: category iff repTurns.length > 0) so the new clause targets only
  starved reads, never a legitimately-empty debrief in a loop.
- F2 relies on the provider streaming the finish_reason event before `[DONE]` (OpenAI/DeepSeek shape),
  which the parser records regardless of ordering since it logs in `finally` after the stream drains.

## Status
Complete once the gate output above shows exit 0. The third agent earned its keep: it caught that the
read fix's own safety net couldn't recover the blank read it was built to fix.
