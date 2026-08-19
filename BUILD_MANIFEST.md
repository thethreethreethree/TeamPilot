# BUILD_MANIFEST.md — AI Schedule Management System

Tracks the phased build of `ScheduleManagementSystem.md` (Supabase/Vercel/DeepSeek). Build in order;
each phase ends at a founder checkpoint; never build ahead (plan working-agreement).

## Phase status

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Event Store & Derivation Foundation | ✅ **DONE — at checkpoint** | `0220` live, pure projector + append/read API, 17 tests, gate exit 0, append-only verified live. Commit `40f8ddb1`. |
| 2 | Coverage Requirements & Constraint Model | ✅ **DONE — at checkpoint** | schedule_employee roster (`0221`) + pure hard/soft predicates + 20 boundary tests. Commit pending. |
| 3 | The Decision Authority (single verdict, A40) | ✅ **DONE — at checkpoint** | `evaluateChange → Verdict`, single-source proven (grep+test), 8 drift-guard tests. Coverage=overridable, conflicts=absolute, zero-impact=autoApprovable. Open: rest-between-shifts (P3-2), RQ6 authz. |
| 4 | AI Reasoning Layer (DeepSeek propose; deterministic gate) | ✅ **DONE — at checkpoint** | Resolution search (deterministic) + AI layer (parse-then-confirm + recommend-with-why, warm+plain). Advisory by construction (imports no authority). 14 tests. A41 DeepSeek verified live. |
| 5 | Manager/Admin Interface | ✅ **MVP DONE** | Roster (API+UI), grid schedule view, file import (CSV: extract→AI-map→preview→atomic commit, +UI), time-off review (evaluate→verdict+candidates+AI proposal→approve/deny, +UI), sub-nav + Sidebar link. All gate-tested backend; UIs browser-verified. OPEN: coverage-requirement editor, xlsx/PDF extraction. |
| 6 | Employee Interface | ⬜ pending (needs staff accounts) | Personal schedule view, self-service time-off/availability/swaps. Deferred: staff are standalone (no accounts) until the Elostate-user link opens. Manager currently records time off on their behalf (Phase 5 review flow). |
| 7 | Make Learning Visible & Close the Loop | ⬜ pending | |
| 8 | Ground-Up Audit & Hardening (1.7) | ⬜ pending | Full A41 sweep. (RQ2 permanent append-only invariant already landed early — verify:live category (d).) |

## Decisions log (grounded, override welcome)

- **Tenancy = `company_id`** — A28 precedent (166 migrations vs 0 for `org_id`). `org_id` in the plan maps to it.
- **D1 — `schedule_event` is a new table** (not the generic `events`). Spec-as-written.
- **D2 — no materialized derived-state tables in Phase 1** — A31 (no schema without a read-consumer); the pure projector is the source. Revisit when a Phase 5/6 reader needs a materialized read.
- **Append-only = fail-loud raise-trigger + revoked grants** — the plan's choice over `0004`'s silent rule (honesty, 3.4). Verified live.

## Founder decisions — RESOLVED (2026-08-19 picker)

- **RQ5 — employee model:** STANDALONE staff records (no Elostate account required); user_id link is a future addition. The scheduling system is a standalone tool for managers/admins. ✅
- **Coverage minimum:** block-by-default, manager-overridable, gap marked. ✅
- **Zero-impact time-off:** auto-approve. ✅
- **NEW — file upload (PDF/Excel/CSV)** for staff + schedule-template data entry → Phase 5. ✅

## Open founder decisions
- None currently blocking. Phase 3 is ready to proceed on your go.

## Residual queue
See `docs/tbc/2026-08-19-schedule-event-foundation/closure.md` (A36-ranked): RQ1 (opened/closed), RQ2–RQ5.

## Phase-5 hardening (proactive audit 2026-08-19, flagged not blocking)
- ✅ **Commit atomicity — FIXED** (`0222` apply_schedule_import RPC): the whole import runs in one transaction, rolls back wholesale on any failure. A 500 now means nothing was written.
- **Re-import de-dup** — import-once assumed; re-importing appends duplicate shifts. Fix: skip a shift key already present.
- **Event payload-ref validation** — the event-append + commit routes don't verify a payload's shiftId/employeeId belongs to the company's real shifts/roster. Inert (the projector ignores unresolved ids + events are RLS-company-scoped), but a route-layer check would be tidier.
- ✅ **RQ6 role-per-event-type — FIXED**: the event-append route now gates manager-only event types on ctx.isAdmin (TIMEOFF_REQUESTED/AVAILABILITY_SET/SWAP_REQUESTED stay open to members). Closes the raw-API self-approve gap. 4 tests.
