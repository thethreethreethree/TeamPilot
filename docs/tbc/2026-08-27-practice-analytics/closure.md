# CLOSURE — Practice analytics

## What shipped
The founder's practice analytics, on the §A18 framing they chose ("closest to the original feedback" — the manager
coaches from per-rep signal). Each scored practice attempt is now an append-only `coach.practice_scored` event. A rep
sees their own per-skill trend ("Your practice" on the Training tab); the manager sees each rep's practice activity +
growth DIRECTION (improving / holding / slipping) — unranked, framed as growth over time, never a leaderboard. No
migration: it reuses the immutable events store (§3.1), and the write precondition was checked against the schema, not
assumed (§1.5.3).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). 9 aggregation tests lock the honesty + §A18 seams; typecheck clean; the write
mirrors salesDissect's proven event insert; the events schema accepts the kind (0004_events.sql, checked).

## The un-named reliance
- **The append runs in `after()` and is best-effort.** A dropped write means one attempt isn't in the trend — never a
  crash, never a wrong number, and the score the rep sees is unaffected. Acceptable for additive analytics; if
  completeness ever mattered more, move the write inline before the response.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Trend is a first→latest applied-score direction with a ±6 threshold, not a regression line, and the manager view is per-rep (no team-wide practice rollup).",
    "why_skipped": "A legible up/holding/slipping direction is what a manager coaches from in a meeting; a regression line and a team volume/avg-improvement rollup are additive polish on top of the same events, not correctness gaps.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T05:35:00+08:00",
    "outcome": "OPENED + bounded: the per-rep growth direction delivers the founder's coaching value today; richer stats are additive over the same event stream, surfaced not silently skipped."
  },
  {
    "id": "R2",
    "item": "The event write + route reads are checked by the tested aggregate + a schema read, not a live end-to-end assertion.",
    "why_skipped": "No integration harness hits the live admin DB in the gate; the aggregation is fully unit-tested and the write mirrors salesDissect's proven insert. A real scored practice showing up in the trend is founder visual-verify.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
