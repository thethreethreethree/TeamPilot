# Ground-up audit — Schedule Management System (1.7, Phase 8)

Outside-view (1.3), foundation-up. Built fast across ~27 commits this session, so audited as if someone
else's. An empty flag list would itself be suspicious (1.7) — the honest flags are at the end.

## Layer 0 — Environment / external config (A41 / 1.5.3)
- ✅ **DeepSeek** live-verified: `/api/health` → `llmReady:true, providers.deepseek:true, activeProvider:deepseek`.
- ✅ LLM/heavy routes export `maxDuration` (commit, propose, evaluate). Preview is a pure parse (no LLM), correctly none.
- 🟨 **MED — org timezone ABSENT.** `companies.timezone` does not exist (verified). Shift times are stored/compared as "HH:mm" strings; correct within a day, but cross-midnight coverage windows + any real multi-tz use need a stored tz. **Flag RQ4** — add `companies.timezone` + backfill before real cross-tz scheduling.
- ℹ️ Supabase env assumed present per-environment (the app runs); per A41, verify preview *and* prod when the module goes to a customer.

## Layer 1 — Schema / events (3.1)
- ✅ **Append-only enforced + live-verified.** `0220` raise-trigger + revoked grants; the permanent `verify:live` registry asserts the trigger (a future migration dropping it fails CI). Behavioral live check confirmed UPDATE/DELETE both raise.
- ✅ **Event-integrity CLEAN.** No `UPDATE`/`DELETE` on `schedule_event` anywhere outside `0220`. Corrections are new events.
- ✅ **Tenant isolation.** `company_id` + RLS (`auth_company_id()`); the invariant gate confirms every schedule mutation route references an auth/tenant gate.
- ✅ Roster (`0221`) + atomic import (`0222`) applied via `db:apply` (ledgered); `verify:live` 27/27 after each.

## Layer 2 — Derivation (projector)
- ✅ Pure + deterministic (no clock/random/IO); replay-determinism + order-independence + purity tested.
- ✅ **No direct derived-state writes** (D2 — derived tables deliberately not persisted; the projector is the source, per A31).
- ✅ Forward-compatible: unknown event types + malformed payloads are no-ops (replay survives vocabulary growth).

## Layer 3 — Constraints (4)
- ✅ Hard (pass/fail) vs soft (score) kept in distinct return shapes; boundary-tested (exactly-at-min coverage MEETS, exactly-at-max hours WITHIN); NaN-safe.

## Layer 4 — Verdict authority (A40 / 2.2)
- ✅ **Single source.** `meetsCoverage`/`isEligible`/`withinLimits` are called ONLY inside `authority.ts` (grep-proven; the one other hit is a comment). Resolution search reuses `evaluateChange`, never re-derives.
- ✅ Drift-guard tests exercise both branches of every term, especially the override (overridable coverage vs absolute conflict).
- ✅ **RQ8 (post-audit correctness fix) — weekly-hours cap is now WEEK-SCOPED.** `weeklyHoursOf` previously summed an employee's hours across the ENTIRE append-only history (the projector replays every event), so the "weekly" cap inflated to all-time and `over_hours` — an absolute, non-overridable block — falsely fired more as the log grew. Now scoped to the target shift's ISO-Monday week (`weekStartOf`, UTC-deterministic). Regression test fails under the old all-time sum (detection-proven); +5 tests. Boundary = Monday default → **RQ7**.

## Layer 5 — AI layer (5 / 3.3)
- ✅ **Advisory by construction:** `ai.ts` imports `llmCall`/fence/voice/eventSchema only — NOT constraints/authority. It cannot compute the gate or override the verdict.
- ✅ **Fenced:** untrusted text carries `CONVERSATION_IS_DATA` (4 uses across parse + mapping prompts).
- ✅ **Validated + fail-loud:** a parsed event is schema-validated before it can be written; a malformed parse returns "unclear"; the mapping proposal omits codes it cannot read (never guessed); the review proposal fails soft (the deterministic verdict always stands).

## Layer 6 — Interface (routes + UI)
- ✅ Every write route: authenticated + company-scoped + **manager-gated** (`ctx.isAdmin`); `company_id` server-resolved (tenant-pin, never the body).
- ✅ Honest errors (no false-empty; a read failure is a real 5xx); no raw error `.message` to the client (CWE-209 gate passes).
- ✅ UIs theme-safe (0 leaks) + typecheck-clean.
- ✅ **RQ11 (render-class audit) — FIXED: time-off decision state-bleed.** Changing the employee/dates after evaluating didn't clear the on-screen verdict, so a manager could approve for a different person than the one evaluated (the decide route records as-is, no server re-eval). Now any input change clears the evaluation + hides the decision block. Swept the render-class lenses across all 5 pages: shell-scroll idiom present everywhere, no throwing browser APIs, grid/coverage read-only or simple-add (no evaluate-then-act bleed), VA/CSV import previews cleared on input change.
- ✅ **RQ12 (unbounded-select audit) — FIXED: the import roster read was unpaged.** Both commit routes (CSV + VA) read the existing roster with a bare `.select("name").eq(company_id)` — capped at PostgREST's 1000 rows. A company with >1000 staff would get a truncated roster, so `planImport` treats staff beyond row 1000 as NEW → duplicate staff records on import. Now `fetchAllPaged` (ordered by id, stable paging), matching the events GET; a read failure is an honest 500, never a silent short roster.
- ✅ **RQ13 (double-write audit) — FIXED: write buttons guarded only by React state.** Every schedule write action (roster add, coverage add, time-off decide, CSV + VA import commit) gated a double-submit on `busy`/`saving` STATE — which two fast clicks both read as idle before the re-render disables the button, firing twice → duplicate staff / requirement / import. Added a synchronous `useRef` latch to each (the append-only-double-write class). UTC-today-in-browser + CSV-export-formula-injection lenses swept clean (no `toISOString` in a page; the import only reads CSV, no export).
- ℹ️ **UI render not yet visually verified by the founder** — the gate can't render React; roster/grid/import/timeoff/coverage need a human look.

## Open flags (ranked by severity)
| # | severity | flag | recommendation |
|---|----------|------|----------------|
| RQ8 | ✅ **FIXED (correctness)** | weekly-hours cap summed ALL history, not one week | `weeklyHoursOf` now scopes to the target shift's ISO-Monday week (`weekStartOf`); the `over_hours` block no longer inflates as the append-only log grows. Regression-locked + detection-proven. |
| RQ9 | ✅ **FIXED (correctness)** | double-booking blocked legitimate SPLIT shifts (same-date, not time-overlap) | `double_booked` (documented as "can't be in two places") was implemented as `o.date === shift.date`, wrongly blocking a same-day non-overlapping second shift — which the VA schedules use (Alex 10–14 + 19–23). Now gated on `rangesOverlap` (time clash). Regression-locked + detection-proven. |
| RQ10 | ✅ **FIXED (correctness)** | time-off conflict only checked a shift's START date, missing an overnight shift's next day | An overnight shift on X occupies X AND X+1; `time_off_conflict` checked only X, so an approved day off on X+1 didn't block an overnight shift running into it (the VA data has overnight shifts). Now span-aware via `crossesMidnight` + `addDaysIso` — tz-independent (the shift's own local dates). Same class as RQ8/RQ9 (check the SPAN, not the start); A26 sweep. Regression-locked + detection-proven. |
| RQ15 | ✅ **FIXED (correctness)** | coverage overcounted a colleague already on approved time-off | Approving time-off does NOT unassign the person (`TIMEOFF_APPROVED` only sets status), so an approved-off employee stays in `shift.assigned`. `coverageAfter` counted them as present — so evaluating one person's time-off overcounted a colleague already off, and a manager could approve overlapping time-off that understaffs a shift with no warning. Now counts only employees actually present (excludes anyone `shiftHitsApprovedTimeOff`, span-aware per RQ10). Regression-locked + detection-proven. |
| RQ16 | ✅ **FIXED (A26 sweep, latent)** | swap path lacked the double-booking check the assign path has | RQ9 fixed double-booking in the ASSIGN path, but the SWAP path (also assignment-creating) never checked it — a swap could put the to-employee on a shift overlapping one they already work. Swap is Phase-6-dormant (no UI wires it yet), so latent — but the code exists and should be consistent. Now the swap path runs the same `rangesOverlap` double-booking check. Detection-proven. |
| RQ17 | ✅ **FIXED (RQ8 sibling + DRY)** | the resolution search had its OWN all-time `weeklyHoursOf` | RQ8 week-scoped the hours sum in `authority.ts`, but `resolution.ts` had a SEPARATE copy that still summed ALL history — so the fair-load ranking + the displayed candidate hours skewed to all-time as the log grew (the drift A40/A26 warn about between two copies of one computation). Extracted ONE shared week-scoped `weeklyHoursOf` into `constraints.ts`, used by both the authority and the resolution search. Detection-proven (prior-week hours no longer count). |
| RQ18 | ✅ **FIXED (RQ17 class, DRY)** | the row→domain mappers were duplicated across read routes | The ScheduleEvent row-mapper was copied in 3 routes (events GET, coverage GET, timeoff/evaluate) and the Employee mapper in 2 — a column added to the shape would update one copy and silently miss the others (same drift as RQ17, one layer down). Extracted `eventRow.ts` (mirroring `employeeRow.ts`); all read routes now use the single shared `rowToEvent`/`rowToEmployee` + `*_COLUMNS`. Verified no inline mapper/column-literal remains. Behavior-preserving. |
| RQ4 | **MED** | org timezone not stored | add `companies.timezone` + backfill before cross-tz / cross-midnight scheduling |
| RQ7 | **LOW→MED** | workweek-start is a hardcoded Monday default | the hours-cap week boundary is ISO Monday; a company whose payroll week starts Sunday/Saturday needs a `companies.workweek_start` setting (same `companies`-settings family as RQ4). Documented default until set. |
| RQ6 | ✅ **FIXED** | event-append route now role-per-event-type gated | manager-only types require ctx.isAdmin; TIMEOFF_REQUESTED/AVAILABILITY_SET/SWAP_REQUESTED open to members. 4 tests. |
| — | LOW | re-import de-dup (import-once assumed) | skip a shift key already present on re-import |
| — | LOW | requirement→shift mapping is first-version (day-applies / time-overlap) | refine when coverage is defined against specific shifts |
| — | LOW | event payload shiftId/employeeId not route-validated vs the company's real shifts/roster | inert (projector ignores unresolved ids + RLS scopes events); add a check for tidiness |
| — | INFO | UI render unverified by a human | founder visual pass on the 5 schedule pages |

## Verdict
The schedule system is **structurally sound foundation-up.** No CRITICAL or HIGH flags. The event-sourcing
discipline, single-source verdict (A40), advisory-only LLM, tenant isolation, and append-only enforcement all
hold and are gate/live-verified. The open flags are MED (tz, role-gate) and below, each recommended, none
blocking the manager MVP. Not yet go-live for employee-facing use (Phase 6 + the MED flags) — go-live-ready as
a manager tool once the founder visually confirms the UIs.
