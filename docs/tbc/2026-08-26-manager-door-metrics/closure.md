# CLOSURE — manager dashboard: per-rep door metrics

## What shipped
Each rep's all-time door activity — 🚪 knocked · presentations · sold — now shows on the manager's Coach Assessment
view, on the per-rep coaching cards and in the "no coached sessions yet" list (so an active rep whose audio didn't
capture still shows they're working). Uses the existing `getAllTimeKpi` (verified real numbers), best-effort so a KPI
read error renders nothing rather than a false 0. Labelled "door activity", alphabetical — leader-visibility of
objective results per A18, not a coaching leaderboard.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Typecheck enforces the field; the coach-assessment tests pass.

## The un-named reliance
- **rep_kpi_daily is rep+manager RLS**, so `getAllTimeKpi(a.id)` (RLS client) returns a team member's totals for a
  manager caller. Relied upon; consistent with getKpiForDay's documented behavior. If that RLS ever tightened, the
  best-effort .catch degrades to null (no metrics shown) rather than an error — no false data, no page break.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Metrics are ALL-TIME only; no per-period (today / this week) toggle.",
    "why_skipped": "All-time matches the rep's own dashboard bubbles and answers 'show their door metrics'. A period toggle needs getTodaysMetrics wiring + a UI control — a follow-up, kept out to hold the scope tight while several other founder requests are queued.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-26T09:52:00+08:00",
    "outcome": "OPENED + bounded: the founder asked to SHOW the door metrics (done, all-time). Period-scoping is an enhancement surfaced for the founder, not a gap in the request."
  },
  {
    "id": "R2",
    "item": "The per-rep door display is not separately unit-tested (relies on typecheck + the route test's best-effort path).",
    "why_skipped": "It's a presentational wiring of a tested data function (getAllTimeKpi) behind a best-effort null; the type enforces the field and the route test proves the response never breaks. A render test asserting the row appears with activity would add marginal coverage; deferred.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
