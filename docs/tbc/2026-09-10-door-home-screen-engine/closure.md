# CLOSURE — door home screen, Phase 05: the day-target engine

The build's core arithmetic is complete: `calculateDayTarget` + `dialFill`, pure and DB-free, with the worked
example and every enumerated edge case pinned by tests (results in check.md). This is increment 1 of the phased build the
founder chose; the decision record lives in `INSPECTION.md` and the 100% source inspection in `EVIDENCE.md`.

## What this increment does NOT do (un-named-reliance half)
- No database, no migration, no UI, no caller — the engine is not yet reachable from the app. Phase 04 (data
  model + the read layer that computes the 30-day ratios and freezes the day target) is the next increment,
  then 06/07/08 (pager, dials, logging) and 09 (verification).
- The starter ratios, floor/ceiling (20/200), and the "qualified" threshold (≥10 presentations AND ≥1 sale in
  30 days) are documented DEFAULTS awaiting John's veto, not settled product truth.
- Local-day boundaries, RLS, and the manager goal-setting authz are Phase-04 concerns, deliberately not here.

## Residual (A36 — read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-starter-as-ratios",
    "item": "Implementing the 'fixed starter target' (Q4) as starter RATIOS rather than a hardcoded 80-door number.",
    "why_skipped": "Assumed the two are equivalent — the thing I was most sure didn't matter.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-10T06:26:30+08:00",
    "outcome": "OPENED. Ratios are the better choice and it does matter: a hardcoded 80 could not produce the presentations/sold STARTER targets that Q2 (all three dials have targets) requires, and would drift from the real formula. Starter ratios yield all three targets consistently AND naturally reproduce the mockup's 18/80 for goal 2. Confirmed correct; noted for John since he framed Q4 as 'a fixed starter number'." },
  { "id": "R2-floor-ceiling-defaults",
    "item": "The 20/200 door floor/ceiling are my numbers, not John's.",
    "why_skipped": "05-target-engine.md explicitly lets the builder choose + document these.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-qualified-threshold",
    "item": "The 'qualified' boolean is computed by the caller (Phase 04), not here; its threshold is a default.",
    "why_skipped": "Belongs to the read layer; the engine only consumes the boolean.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md — `npm run check` run whole with pasted output + exit code, plus the round-up mutation gate.
