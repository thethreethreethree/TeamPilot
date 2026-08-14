# CLOSURE — After-Pitch failure diagnosis (exact cause on screen)

## What shipped
Founder request: when After-Pitch generation fails, show the EXACT issue on screen, not a raw code / a blank read
(and the 504 question). The After-Pitch screen now names every failure cause:
- a generation HTTP failure reads as its cause via `explainAfterPitchError` — a 504/timeout → "That took too long
  to build — your recording is safe, tap Try again"; 502/503 → transcription temporarily unavailable (audio
  safe); 403 → private; 429 → too many; else a friendly generic — never a raw "HTTP 504".
- an empty (two-sided) read whose write-up came back blank is named by `EmptyReadBanner` (the one case the screen
  was silent on; the one-sided case was already named by BlankReadRecovery, left as-is — no duplication).

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-after-pitch-failure-diagnosis)
typecheck ✓ · lint ✓ · theme-leak audit — leaks: 0 ✓
RLS audit ✓ · Invariant audit — Violations: 0 ✓ (incl. "every LLM/transcription route exports maxDuration")
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  416 passed | 1 skipped (417)
     Tests  2886 passed | 15 skipped (2901)
exit 0
```
Also shipped in this build: `maxDuration` 60→300 on `/after-pitch`, `/review`, `/finalize` (F3) — the recurring
504 fix (the generation routes were killed at the 60s ceiling on a long call).

## Residual (A36)
```json
[
  { "id": "R1", "item": "Browser check that a real 504 (a genuinely slow generation) renders the friendly 'took too long' message.", "why_skipped": "The mapping is unit-gated; the client render is a page effect (repo has 0 *.test.tsx). A staging repro with a forced slow route is the honest end-to-end check.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T08:42:00Z", "outcome": "Flagged." },
  { "id": "R2", "item": "If 504s are FREQUENT on a specific route, the real fix is that route's maxDuration / splitting the work — the diagnosis names it but does not prevent it.", "why_skipped": "Out of scope for a diagnosis feature; flagged to the founder to say which action 504s so the route budget can be raised.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T08:42:30Z", "outcome": "Flagged to the founder." },
  { "id": "R3", "item": "Clock-drift artifact: started_at 08:30Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T08:43:00Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on `BlankReadRecovery` continuing to own the one-sided (capture-gap) cause — `diagnoseAfterPitchRead`
  returns null for a gap precisely so the two surfaces don't both explain it.
- Relies on the `/after-pitch` POST returning a meaningful HTTP status on failure (it does: 403 private, 5xx on
  a generation/timeout failure) for `explainAfterPitchError` to key on.

## Status
Complete once the gate shows exit 0. Every After-Pitch failure state now names its cause in plain language — a
504 reads as "took too long, your recording is safe", an empty read says so, and the raw HTTP code is gone.
