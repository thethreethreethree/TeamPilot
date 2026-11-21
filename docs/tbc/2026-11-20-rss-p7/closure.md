# CLOSURE - RSS Phase 7

## What is true now

A manager can write a practice scenario (optionally from a real call), assign it to reps on their team with a due
date, move the due date (recorded as a change), and see each rep's status. A rep sees "Assigned to you" on the
role-play page, practices it, is scored against the scenario's own skill by the server, sees pass / not passed yet,
can ask a follow-up question about the review, and the assigning manager's bell says they practiced. The manager's
screen is built but not on any page until D18 says where it goes.

All of Phases 0-7 now compile, lint, pass the audits and the suite on this machine, and their migrations apply in
order (and again) on Postgres 16.4 — the outputs and exit codes are in check.md.

## Residual

```json
[
  {"id": "R1-d18-unmounted", "item": "TrainingManager is not on any page, so the Phase 7 'Looked at' (a manager turns a real call into a scenario and assigns it) cannot be done yet.", "why_skipped": "D18 (Bootcamp or the Sales Coach Training tab) is open; the plan does not invent an answer.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T20:45:00Z", "outcome": "Opened: reachability-audit ALLOWLIST entry names D18 and the mount step; listed in OPEN.md."},
  {"id": "R2-db-not-applied", "item": "0271-0283 are not applied to production; nothing here ran on Supabase.", "why_skipped": "Supabase project suspended (storage quota).", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T20:45:00Z", "outcome": "Opened: OPEN.md — npm run db:verify then db:apply after restore."},
  {"id": "R3-rls-unexecuted", "item": "The 0282 select policies (rep's own / manager under the tree) have no executed allowed-and-refused test.", "why_skipped": "The PGlite replay ran as superuser; the plan's gate wants them ported into the RLS suite.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-20T20:45:00Z", "outcome": "Opened: OPEN.md, with the sql-harness as the home."},
  {"id": "R4-postgres-gates-skipped", "item": "migration:audit and sql:harness skipped (no Postgres on this machine); PGlite replay stood in for the first, not the second.", "why_skipped": "No Postgres or Docker installed here; CI runs both.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-20T20:45:00Z", "outcome": "Opened: CI on push is the check."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
