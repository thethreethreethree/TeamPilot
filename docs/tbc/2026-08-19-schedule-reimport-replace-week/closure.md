# Replace-the-week re-import — Closure

## What shipped
Re-importing a week now **replaces** it: the existing shifts in the imported date span are superseded
(SHIFT_CANCELLED) and the new ones inserted, atomically, via `apply_schedule_import` (migration 0223). The
supersede decision is computed once in TypeScript (`supersededShiftIds`, the projector is the single source of
live shifts) and only APPLIED by the RPC. The manager sees "This replaces N existing shifts" before commit
(§3.4 honesty) and "replaced N" after. Shared `commitImport` + `readExistingShifts` keep the CSV and VA
formats, and the preview and commit, on one code path.

## Verification (A38)
Migration applied to the live DB:
```
npm run db:apply
[db-apply] 1 pending migration(s): 0223_apply_schedule_import_replace_week.sql
✅ ALL 27 invariants hold.
[db-apply] ✓ verify:live passed — structural invariants intact after the migration.
EXIT: 0
```
Canonical gate:
```
npm run check   →   typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
EXIT: 0
```
(Full paste in the commit body.)

## Residuals (ranked; A36 — top must be opened)
```json
[
  { "id": "R1", "item": "The preview route now does one paged schedule_event read (to count willReplace) it didn't before.", "why_skipped": "Preview is a manager-frequency action, not a hot path, and the read is non-blocking (a failure logs + defaults willReplace to 0, preview still returns).", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-19T23:05:00Z", "outcome": "OPENED + confirmed: readExistingShifts is one fetchAllPaged over the company's events (same read the grid/events endpoints already do), wrapped in try/catch so a failure degrades the warning, never the preview. No new hot-path cost." },
  { "id": "R2", "item": "Span semantics can surprise: importing non-contiguous days (e.g. Mon + Fri) supersedes the whole Mon..Fri span, clearing Tue-Thu.", "why_skipped": "This is the founder's explicit replace-the-week pick over skip-duplicates, and the pre-commit warning shows the exact count so it is never silent.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R3", "item": "An overnight shift on the span's max date is superseded wholesale (its next-day portion is outside the span).", "why_skipped": "Shifts are dated by start date everywhere in the system; superseding by start date is consistent. Overnight/tz nuance is the tracked RQ4 family.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R4", "item": "The MIGRATION_REQUIRED (503) fail-loud path is now unreachable in prod (0223 applied).", "why_skipped": "Retained as the guarded fallback for the deploy-before-migrate window and any future environment where the migration lags the code — correct discipline, not dead weight.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```
