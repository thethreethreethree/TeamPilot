# Phase 1 — Check (A38: the canonical command by name, coverage not verdict)

Canonical gate: `npm run check` =
`typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test` (7 gates).

## Per-gate coverage (this session)
- **typecheck** — PASS (new files: types.ts, deriveState.ts, eventSchema.ts, route.ts; strict + noUncheckedIndexedAccess).
- **lint** — PASS.
- **theme:audit** — PASS (0 theme-bound leaks).
- **rls:audit** — PASS.
- **invariant:audit** — PASS (Violations: 0).
- **tbc** — PASS (docs match manifest; 21 manifest entries; artifacts present).
- **test** — PASS. Schedule suite: 17/17 (deriveState 9, eventSchema 8). Full suite: 3068 passed (3051 prior + 17 new), see the final run block below.

## Live DB verification (A41 — verified, not just migration intent)
- `npm run db:apply` applied `0220` and auto-ran `verify:live` → **27/27 invariants hold**, including
  tenant-isolation (every `company_id` table RLS-on + behaviorally enforced: anon reads 0) — so
  `schedule_event` is confirmed RLS-protected on the live project.
- **Append-only enforced LIVE (behavioral, rolled back).** A one-off check (transaction, no data written)
  attempted UPDATE and DELETE on a `schedule_event` row on the live DB — BOTH raised
  `schedule_event is append-only: UPDATE/DELETE is not permitted`. So the fail-loud raise-trigger fires on
  the real project, satisfying the §6/A41 "verify the event table truly rejects UPDATE/DELETE in the live
  project, not just in migration intent" precondition. (A permanent `verify:live` invariant locking this is
  RQ2 — Phase-8 hardening.)

## Findings
**No findings.** No violations surfaced by any gate; no deviations beyond the flagged D1/D2 scoping
decisions (build.md), which are grounded in A28/A31 and open to override.

## Final full-gate run
```
npm run check → exit 0 (all 7 gates)
Test Files: 460 passed | 1 skipped
Tests: 3068 passed | 15 skipped
```
