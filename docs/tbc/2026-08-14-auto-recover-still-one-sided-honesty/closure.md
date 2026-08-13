# CLOSURE — still-one-sided honesty terminal

## What shipped
Tracing every /auto-recover terminal outcome for workflow continuity (§1.5.1 layer 3), one branch dead-ended:
`still-one-sided` (the saved audio holds one voice) showed the manual re-transcribe card, which would only
reproduce the same one-sided result — a false-promise loop. The page now records the terminal status and renders
an honest terminal for `still-one-sided` instead. The recoverable outcomes (could-not-decide / failed) keep the
manual card, where a tap/retry genuinely helps.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ · invariant:audit ✓ (Violations 0)
tbc ✓ — docs · manifest · artifacts · residual · freshness
Test Files 411 passed | 1 skipped (412); Tests 2850 passed | 15 skipped (2865)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The still-one-sided terminal is a UI-only branch with no node render harness.", "why_skipped": "Consistent with the existing autoGen/autoRecover latches (also un-harnessed); the load-bearing distinction (which auto-assign reasons are unrecoverable) IS tested in autoSpeakerAssign.test.ts.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T02:35:00Z", "outcome": "Accepted; covered by the predicate tests + code review." },
  { "id": "R2", "item": "`already-attempted` still shows the manual card even if the ORIGINAL attempt was still-one-sided (the status doesn't carry the prior reason).", "why_skipped": "already-attempted means a prior run set the marker; the manual /retranscribe (no marker) is a reasonable escape hatch, and the prior reason isn't persisted. Low-frequency edge.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T02:35:30Z", "outcome": "Accepted; persisting the prior reason is a follow-up if it matters." }
]
```

## Un-named reliance
- Relies on "`single-cluster` (from autoAssign) ⟺ the audio has one voice ⟺ re-transcribe can't help", which the
  autoSpeakerAssign contract + tests establish. If a future auto-assign returned single-cluster for a different
  reason, this terminal's copy would need to follow.

## Status
Complete once the gate shows exit 0. Every auto-recover terminal now leaves the rep either with a rebuilt read,
a useful next action, or an honest explanation — no dead-end loop.
