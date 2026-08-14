# CLOSURE — After-Pitch recovery remainder (⑥ stale-reload + ⑧ single-voice loop)

## What shipped
The last two gaps in customer-missing After-Pitch recovery:
- **⑥ stale-reload:** when a successful recovery's client refresh was lost, the reload (transcript now two-sided →
  auto-recover 409 `canonical`) was ignored, leaving the old blank read forever. The client now regenerates on
  `canonical`, healing it once — no server-side generation, so no double-charge.
- **⑧ single-voice loop:** a genuine one-voice decline returned a generic `already-attempted` on reload, which
  offered a re-transcribe card that re-charged STT and dead-ended. The decline is now recorded
  (`coach.auto_recover_declined`) and the reload returns `still-one-sided` — the honest terminal, no card.

Together with the prior build (② first-visit engage + ⑦ transient-release), all FOUR customer-missing recovery
gaps found in the hole-hunt are now closed.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-after-pitch-recovery-remainder)
typecheck ✓ · lint ✓
theme-leak audit — Theme-bound leaks: 0 ✓
RLS policy audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2873 passed | 15 skipped (2888)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "Browser repro of finding ⑥: recover a session, drop the client generate() (navigate away), reload → confirm the read fills in from the canonical transcript.", "why_skipped": "Client page effect; repo has 0 *.test.tsx. The route-side pieces are gated; this half is a promise verified in a browser.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T07:40:00Z", "outcome": "Flagged; verify on staging." },
  { "id": "R2", "item": "Clock-drift artifact: started_at 07:30Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T07:40:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on the auto-recover route returning `canonical` (409) when the transcript is already two-sided (its
  existing precondition), which the client now treats as "regenerate the stale read".
- Relies on `coach.auto_recover_declined` being readable by the route's admin client on reload (service-role).

## Status
Complete once the gate shows exit 0. A lost-client recovery self-heals on reload; a genuine one-voice call stays
an honest terminal instead of a re-charging dead-end. The customer-missing recovery flow is now closed end-to-end.
