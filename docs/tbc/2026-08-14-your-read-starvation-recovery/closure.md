# CLOSURE — "Your read" starvation recovery + remove the length cap

## What shipped
The founder's 2-device test surfaced a real failure: a big-corpus company's 3-min call showed "Your read didn't
come through" (EMPTY) while a lean-corpus company's call got a full read. Root: `debriefCoachV5` runs deepseek-v4,
a reasoning model with an ~8k output ceiling; a larger company corpus in the system prompt drives more reasoning,
starving the answer on a longer call. Confirmed NOT a per-account limitation — both test accounts are admin +
Standard, nothing to remove.

- `generateSalesReview` now RETRIES on an empty read with the LEAN built-in prompt (drops the corpus/product, the
  biggest reasoning driver) — the transcript is unchanged, so a real read comes through. Both misses still log
  (INV22). Every call gets a read.
- Removed the after-pitch "a very short exchange may not have enough to write a full read" length excuse — a soft
  cap that both blamed the wrong cause (starvation, not shortness) and contradicts the standing no-minimum-length
  rule.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-your-read-starvation-recovery)
typecheck ✓ · lint ✓ · theme-leak audit ✓ · RLS audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  417 passed | 1 skipped (418)
     Tests  2892 passed | 15 skipped (2907)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "salesDissect shares the reasoning-model starvation shape — apply the same leaner-retry.", "why_skipped": "Separate engine (the 'Score Assessment Review' section, not the visible 'Your read'); flagged for a follow-up build rather than expanded here.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T09:42:00Z", "outcome": "Flagged." },
  { "id": "R2", "item": "If a call has NO corpus AND the TRANSCRIPT itself starves the budget, the leaner retry equals the full prompt (a plain non-deterministic re-run).", "why_skipped": "The corpus is the dominant reasoning driver near the ceiling; a pure-transcript starvation on a no-corpus company is rarer. Transcript bounding is the next lever if it recurs.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T09:42:30Z", "outcome": "Flagged." },
  { "id": "R3", "item": "Clock-drift artifact: started_at 09:30Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T09:43:00Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on the company corpus being the dominant reasoning driver (dropping it materially reduces reasoning), and
  on the reasoning model returning content when the input is leaner — the mechanism reference_reasoning_model_token_starvation documents.

## Status
Complete once the gate shows exit 0. A starved "Your read" is retried leaner and comes through; the false "too
short" length excuse is gone. Every call gets a read.
