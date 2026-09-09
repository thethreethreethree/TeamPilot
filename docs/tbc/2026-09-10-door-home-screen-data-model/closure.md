# CLOSURE — door home screen, Phase 04: data model + read layer

Increment 2 is complete: the migration (per-rep manager-set goal + frozen day target) and the read layer that
computes the 30-day ratios from the existing door_knocks/pitches and freezes the day's target. It extends the
existing tables rather than duplicating them, reuses the exact 0215 RLS predicate, and degrades honestly with
no goal set. The migration is BUILT but deliberately UNAPPLIED — the founder reviews first.

## What this increment does NOT do (un-named-reliance half)
- The migration is not applied — `getOrFreezeDayTarget` cannot run against prod until `npm run db:apply` lands
  0247. No UI is wired to it yet; the door screen / dials / logging / manager goal UI are the next increments.
- The "qualified" threshold (≥10 presentations, ≥1 sale) and the ratio window are defaults awaiting John's veto.
- The presentations-by-recorded_at vs doors-by-local_date date mismatch is an accepted approximation for a
  30-day ratio, not a day-exact join.
- No manager UI to SET the goal yet (Phase 06/07 increment); the table + its manager-write RLS exist, the
  surface to write it does not.

## Residual (A36 — read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-manager-write-rls",
    "item": "Whether the manager-write RLS on rep_daily_sales_goal actually lets a manager write ANOTHER rep's goal row (the whole point), and blocks a rep writing their own.",
    "why_skipped": "Copied the 0215 predicate and assumed it transfers — the thing I was most sure was fine.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-10T06:38:40+08:00",
    "outcome": "OPENED. The 0215 predicate I copied is a SELECT predicate (rep OR same-company manager). For the goal WRITE I deliberately did NOT include `rep_id = auth.uid()` in the insert/update check — only the manager `exists(...)` clause + `company_id = auth_company_id()`. So a rep cannot insert/update their own goal (no self-write), and a same-company manager can write ANY rep's row in their company. That is exactly Q1 (manager sets it per rep). Confirmed correct by reading the policy back; a route-level isSalesCoachManager check will still front it in the UI phase (defence in depth), mirroring the quota route." },
  { "id": "R2-qualify-threshold",
    "item": "The ≥10 presentations / ≥1 sale qualify threshold + the 30-day window are my defaults.",
    "why_skipped": "Documented defaults awaiting John's veto (Q4).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-date-source-mix",
    "item": "presentations counted by recorded_at, doors/sold by local_date.",
    "why_skipped": "A 30-day ratio doesn't need day-exact precision; documented in the header.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md — `npm run check` whole with pasted output + exit code, the db:dry (pending, not applied), and the
5-test read-layer suite.
