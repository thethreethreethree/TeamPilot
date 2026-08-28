# CLOSURE — deal-value capture on the After-Pitch page

## What shipped
The After-Pitch page (the Standard-flow screen that replaces the session page) now captures the deal value on a
'sold' outcome — an optional inline input mirroring the session page. This unblocks the Revenue and Avg-deal-size
KPIs, which were "building" forever because 0 sold sessions had a `deal_value` (the after-pitch page recorded the
outcome but never the value). The backend was already there; this closes the UI gap the KPI audit surfaced.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The wiring is typechecked; the `/outcome` route incl. `dealValue` is
already unit-tested; the input mirrors the session page's shipped, working pattern. The render + save round-trip on
the after-pitch client page are founder visual-verify.

## The un-named reliance
- **The after-pitch client page has no jsdom render harness** — the input render + save round-trip are founder
  visual-verify. The handler/latch/backend are covered (typecheck + the session-page precedent + the outcome-route test).

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The BROADER capture gap remains: 99/121 sessions have NO outcome recorded at all (reps skip the outcome buttons, which exist on both pages). Deal value only helps the sold sessions that ARE logged. Lifting overall outcome-recording is a habit/prominence problem, not a missing control.",
    "why_skipped": "The founder's pick was deal-value capture (the clear code gap). Nudging reps to record outcomes at all is a separate UX/behavior question.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T13:40:00+08:00",
    "outcome": "OPEN — consider a gentle 'log the result' nudge on completed un-recorded sessions if outcome-recording stays low."
  },
  {
    "id": "R2",
    "item": "Company quota target not set (`sales_coach_monthly_deal_target` null) → Quota tile 'building'. A manager config, not code.",
    "why_skipped": "Config the manager sets in Coaching settings; nothing to build.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T13:40:00+08:00",
    "outcome": "OPEN — set the monthly deal target in Coaching settings to activate the Quota KPI."
  }
]
```
