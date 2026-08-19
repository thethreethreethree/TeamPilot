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
| 5 | Manager/Admin Interface | ✅ **DONE** | Roster with FULL CRUD (add / inline-edit / deactivate-reactivate, `[id]` PATCH), grid schedule view, coverage editor with add + remove (COVERAGE_REQ_DEFINED / _REMOVED tombstone; edit via remove+re-add), time-off review (evaluate→verdict+candidates+AI proposal→approve/deny, +UI), sub-nav + Sidebar link. **Import: BOTH formats built** — CSV (staff×date shift-codes: extract→AI-map→preview→atomic commit) AND the VA presence-grid (.docx/.pdf time-block×staff "On Duty": upload→pick week→coalesce→dated import), the founder's actual format (founder chose "full"; `docs/tbc/2026-08-19-schedule-va-import`; format finding resolved). All gate-tested; UI visual-verification is the founder's remaining check. OPEN: legacy staff×date **xlsx** (CSV done; needs the `xlsx` dep call). |
| 6 | Employee Interface | ⬜ pending (needs staff accounts) | Personal schedule view, self-service time-off/availability/swaps. Deferred: staff are standalone (no accounts) until the Elostate-user link opens. Manager currently records time off on their behalf (Phase 5 review flow). **When built, WIRE UP:** (a) **availability** — `AVAILABILITY_SET` + `deriveState.availability` exist but are DORMANT (no UI writer, and the authority does NOT consult them); when availability is captured, extend `evaluateChange`/`isEligible` to reject assigning someone on an unavailable day/date (latent gap, no current effect since availability is always empty). (b) **time-off unassign** — decide whether approving time-off should AUTO-UNASSIGN the person from their shifts (leaving a gap to fill) vs. the current keep-assigned + exclude-from-coverage model (RQ15). |
| 7 | Make Learning Visible & Close the Loop | ⬜ pending | |
| 8 | Ground-Up Audit & Hardening (1.7) | ✅ **DONE** | `docs/audits/2026-08-19-schedule-ground-up-audit.md` (outside-view, foundation-up; no CRITICAL/HIGH). Findings FIXED + detection-proven: RQ6 (event-append role gate), RQ8 (weekly-hours summed all-time), RQ9 (double-booking blocked split shifts), RQ10 (time-off missed an overnight shift's next day) — RQ8/9/10 a swept class (gate checked a shift's start, not its span). OPEN flags remaining: RQ4/RQ7 (tz/workweek settings — founder decision), re-import semantics (design), coverage-side overnight (RQ4-tangled). |

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

## Manual shift-building — ✅ BUILT (2026-08-19)
`/dashboard/schedule/build` ("Build" tab): a FORM-based builder (date + start/end + headcount + staff
picker) that appends SHIFT_DEFINED then one EMPLOYEE_ASSIGNED per selected staff via the manager-gated
events route. Form-based to match the rest of the schedule UI (roster/coverage/time-off/import are all forms
— grid-click would be the inconsistent outlier); incremental (create the shift, then assign; each
EMPLOYEE_ASSIGNED is independent + projector-deduped, so no atomic-write need). Fulfills the grid
empty-state's "or build a schedule". RQ13 double-submit latch; workflow continuity (view grid / build
another). Visual render is the founder's check. **Possible refinement (founder call): grid-cell-click
editing directly on the schedule grid, if preferred over a separate form page.**

## Open founder decisions
Phases 1–5 + 8 are DONE (manager MVP + both import formats + audit). What now awaits you:
- **Visual-verify the schedule UIs** (the gate can't render React) — especially the VA import flow at `/dashboard/schedule/import` → "Schedule file" tab.
- **RQ4 / RQ7** — where does org **timezone** + **workweek-start** come from (a `companies` setting)? Unblocks cross-tz + the overridable coverage-side overnight nuance.
- **Re-import semantics** — should re-importing replace, add, or replace-the-week? (Naive dedup silently mishandles a re-uploaded correction.)
- **Legacy `xlsx`** — add the `xlsx` dependency for staff×date Excel schedules, or stay CSV-first?
- **Schedule entitlement / positioning (RQ14, surfaced 2026-08-19).** The schedule system is positioned as a STANDALONE tool ("no Elostate account required"), but its ACCESS is currently gated by the 0207 module hard-lock to complete/elostate accounts: a single-module pilot (`access_module = care` or `sales_coach`) is redirected away from `/dashboard/schedule` (`moduleForPath` returns "elostate", `isPathAllowed` denies). Not a bug — the lock works as designed — but the entitlement is an accidental side effect, not a deliberate SKU. **Decide:** is schedule bundled with complete-access only, or should it be its own sellable module (`access_module = 'schedule'` + a path-allow for locked accounts)? Matters if you want to sell scheduling standalone to a scheduling-only customer.
- **Phase 6** (employee self-service) is deferred until staff get accounts; **Phase 7** (make-learning-visible) needs accumulated data.

## Residual queue
See `docs/tbc/2026-08-19-schedule-event-foundation/closure.md` (A36-ranked): RQ1 (opened/closed), RQ2–RQ5.

## Phase-5 hardening (proactive audit 2026-08-19, flagged not blocking)
- ✅ **Commit atomicity — FIXED** (`0222` apply_schedule_import RPC): the whole import runs in one transaction, rolls back wholesale on any failure. A 500 now means nothing was written.
- **Re-import de-dup** — import-once assumed; re-importing appends duplicate shifts. Fix: skip a shift key already present.
- **Event payload-ref validation** — the event-append + commit routes don't verify a payload's shiftId/employeeId belongs to the company's real shifts/roster. Inert (the projector ignores unresolved ids + events are RLS-company-scoped), but a route-layer check would be tidier.
- ✅ **RQ6 role-per-event-type — FIXED**: the event-append route now gates manager-only event types on ctx.isAdmin (TIMEOFF_REQUESTED/AVAILABILITY_SET/SWAP_REQUESTED stay open to members). Closes the raw-API self-approve gap. 4 tests.
- ✅ **RQ8 weekly-hours cap was ALL-TIME, not per-week — FIXED** (post-audit correctness): `weeklyHoursOf` summed every shift in the replayed-from-full-history state, so `over_hours` (an absolute block) inflated week over week and would falsely block legitimate assignments. Now scoped to the target shift's ISO-Monday week (`weekStartOf`). Regression-locked + detection-proven; +5 tests.
- **RQ7 workweek-start = hardcoded Monday** — the hours-cap week boundary is ISO Monday; a Sunday/Saturday payroll week needs a `companies.workweek_start` setting (RQ4 `companies`-settings family). Documented default until the founder sets it.
