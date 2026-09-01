# CLOSURE — null the misleading backfilled `ended_at`

## What shipped
Migration 0240 cleared the fabricated `ended_at` on **218** `ended` sessions the stale-close cron had stamped with
a single close-time (207 of them the identical 2026-08-21T00:28:33Z), whose wall-clock spans ran up to 54.7 days.
The raw session rows are now honest — a session with no knowable end time reports NULL, not a guessed close-time —
matching what the code cap already showed on screen. Audio-backed sessions were never touched. Confirmed live: the
target set went 218 → 0; the 13 audio-backed >4h rows stayed put.

## Verification (A38)
`npm run db:apply` → 30/30 live invariants PASS (pasted in check.md). Live before/after target count 218 → 0
(pasted in check.md). No unit test — one-shot data migration confirmed by the live count.

## The un-named reliance
- Relies on `conversationDurationSeconds` returning null for a missing `ended_at` (already true + tested) so the
  cleared rows read as "duration unknown" rather than crashing a consumer.
- Relies on nothing keying "session ended" off `ended_at` (status is the flag). Confirmed: auto-close-stale filters
  `status='active'`; the 0070 trigger fires on status transitions, not a direct `ended_at` write.

## Residual (A36 — explicit)
```json
[
  {
    "id": "KPI-R7",
    "item": "Recurrence at the source: the 0070 active→ended trigger will keep stamping ended_at=now() when auto-close-stale-cron closes a future batch of long-open sessions, re-creating implausible wall-clock ended_at values on the raw rows.",
    "why_skipped": "The code cap (MAX_WALLCLOCK_SECONDS, shipped + tested) neutralizes these for every DURATION metric, so no user-visible number is affected. A trigger change touches ALL active→ended closes (where now() IS the true end) and is higher-risk than the harm it prevents on raw rows alone.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-01T09:10:00+08:00",
    "outcome": "OPEN — if the raw-row hygiene matters again, fix at the cron (set ended_at to last-activity, not now()) rather than the shared trigger; or re-run migration 0240's condition as a periodic cleanup."
  }
]
```
