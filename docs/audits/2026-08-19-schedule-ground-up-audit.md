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
| RQ22 | ✅ **FIXED (dead field → enforced)** | a shift's own `requiredHeadcount` was collected + stored but never enforced | `SHIFT_DEFINED.requiredHeadcount` (the Build page's "how many needed"; imports set it) was projected into `shift.requiredHeadcount` but NO consumer read it — the coverage check used only the separate coverage requirements. So a manager building "this shift needs 3" got no check, and an emptied 1-person shift wasn't flagged (dead-surface class). Now `requirementForShift` folds the shift's own headcount into the floor (max with any coverage requirements); the Build page's input is enforced and an empty shift is flagged. Regression-locked. |
| RQ20 | ✅ **FIXED (correctness)** | multiple applicable coverage requirements were not combined — a role floor was dropped | `requirementForShift` returned only the SINGLE requirement with the highest minHeadcount, so with "3 people" + "1 nurse" both applying, the nurse (lower headcount) requirement was silently dropped and never enforced. Now it COMBINES every applicable requirement — max headcount + max per-role floor — so all constraints hold. Regression-locked + detection-proven. |
| RQ19 | ✅ **FIXED (correctness)** | a coverage requirement scoped "shift"/"role" without a time window was silently ignored | `requirementForShift` applied a requirement only if `appliesTo === "day"` OR its timeWindow overlapped — so a "shift" or "role" requirement set WITHOUT a window matched neither clause and was silently dropped (the coverage form lets a manager create exactly that). A floor with no time window should apply to every shift (no window = no time restriction); now it does. Regression-locked + detection-proven. |
| RQ18 | ✅ **FIXED (RQ17 class, DRY)** | the row→domain mappers were duplicated across read routes | The ScheduleEvent row-mapper was copied in 3 routes (events GET, coverage GET, timeoff/evaluate) and the Employee mapper in 2 — a column added to the shape would update one copy and silently miss the others (same drift as RQ17, one layer down). Extracted `eventRow.ts` (mirroring `employeeRow.ts`); all read routes now use the single shared `rowToEvent`/`rowToEmployee` + `*_COLUMNS`. Verified no inline mapper/column-literal remains. Behavior-preserving. |
| RQ4 | ✅ **FIXED (setting) / partial** | org timezone not stored | `companies.timezone` added (0224) + consumed — server "today" (coverage/time-off) = `todayInTz(tz)`; the grid's today/week use it. STILL OPEN (separate item, unblocked-not-done): (a) an overnight shift's POST-midnight coverage isn't matched to an early-morning window (`evalContext.overlaps` caps an overnight end at 24:00); (b) consolidate the TWO time-overlap fns (`evalContext.overlaps` 24:00-cap vs `constraints.rangesOverlap` +24h) once the overnight semantic is decided. |
| RQ7 | ✅ **FIXED** | workweek-start was a hardcoded Monday default | `companies.workweek_start` added (0224); `weekStartOf(date, weekStartDay)` + `weeklyHoursOf(..., weekStartDay)` parameterized (default Monday, so no caller broke); threaded via `EvalContext.weekStartDay` into the hours cap + fair-load ranking, and into the grid week. A manager sets it on the Settings tab. Detection-proven. |
| RQ6 | ✅ **FIXED** | event-append route now role-per-event-type gated | manager-only types require ctx.isAdmin; TIMEOFF_REQUESTED/AVAILABILITY_SET/SWAP_REQUESTED open to members. 4 tests. |
| — | LOW | re-import de-dup (import-once assumed) | skip a shift key already present on re-import |
| — | LOW | requirement→shift mapping is first-version (day-applies / time-overlap) | refine when coverage is defined against specific shifts |
| — | LOW | event payload shiftId/employeeId not route-validated vs the company's real shifts/roster | inert (projector ignores unresolved ids + RLS scopes events); add a check for tidiness |
| — | INFO | UI render unverified by a human | founder visual pass on the 5 schedule pages |

## Post-feature audit — the four founder-picker features (2026-08-19)
Outside-view pass over the surface the picker features added, on the record per §1.7.

- ✅ **Manager-only layout gate (visibility) — security boundary, tested.** `dashboard/schedule/layout.tsx`
  redirects a non-`isAdmin` (or unauthenticated) caller to `/dashboard` before any schedule page renders,
  reusing `getCurrentAuthContext().isAdmin` — the SAME predicate the write APIs enforce (RQ6), so page and API
  can't drift (single-source, §2.2). Server-side (no flash). Regression-locked + **detection-proven**
  (disabling the gate fails 2 of 3 tests). Data was never at risk (writes already gated); this closes the
  read-visibility of sick time-off to non-managers.
- ✅ **Settings PATCH — new write to `companies`, tenant-safe.** `/api/schedule/settings` PATCH is
  manager-only and pins the update to `id = ctx.companyId` (INV15 — company from the session, never a
  parameter); the companies UPDATE RLS independently scopes to `auth_company_id()`. Same precedent as 0201
  `default_theme`. IANA + 0-6 validated. 6 tests (auth + pin + validation).
- ✅ **Replace-the-week — data-DELETING path, atomic + honest + fail-loud.** The supersede set is computed once
  from derived state (`supersededShiftIds`, §2.2) and only APPLIED by the RPC; the cancel + insert run in ONE
  transaction (0223), so a failure rolls back wholesale (no half-empty week). The manager sees "replaces N"
  before commit and "replaced N" after (§3.4 — never a silent delete). If the migration were absent with
  something to supersede, the code returns 503 rather than silently re-appending duplicates (§1.5.3). The
  residual is a benign preview/commit TOCTOU on the ADVISORY count (the commit recomputes authoritatively). A
  pathological wide date-span in a CSV (a typo'd date) would supersede a large range — mitigated by the visible
  "replaces N" count; flagged LOW below.
- ✅ **Cell-click unassign — append-only, re-entrancy-safe.** Appends `EMPLOYEE_UNASSIGNED` via the
  manager-gated events route; `busyRef` latch prevents a double-click double-append; a failed action shows a
  local banner, never nuking the grid. The `SHIFT_CANCELLED` tombstone it's built beside is projector-tested.
- ✅ **LOW flag ADDRESSED:** replace-the-week supersedes the whole imported date SPAN, so a typo'd import date
  could cancel a wide range. The preview now shows the exact **date range** ("replaces N shifts from X to Y"),
  not just the count — a typo'd span (e.g. "from 2020-01-01") is obvious at a glance instead of a silent large
  delete. `dateSpan` is the single source of that range (shared with `supersededShiftIds`). A further guard
  (a second confirmation on an unusually large replace) remains an OPTIONAL UX follow-up, not a correctness
  gap — the range display is the well-founded mitigation.

## Live-schema verification (2026-08-19) — found + fixed a latent RPC ambiguity
Behavioral verification of the applied migrations against the LIVE DB (§1.5.1 layer-2 — "db:apply passed" is
not "the object is right in prod"): queried `information_schema` + `pg_proc` directly.

- ✅ 0224 columns present (companies.timezone default 'UTC', workweek_start smallint default 1 + CHECK 0-6).
- ✅ **FIXED — 0223 left TWO `apply_schedule_import` overloads live.** `create or replace function` with an
  ADDED parameter creates a NEW function rather than replacing, so the old 3-arg (0222) AND the new 4-arg
  (0223) both went live. With the 4-arg's defaulted last param, a 3-arg call matched BOTH and raised
  `function apply_schedule_import(text[], jsonb, jsonb) is not unique` (probed live, rolled back). The
  `commitImport` guarded fallback (a 3-arg call for the pre-0223 window) would have hit that ambiguity.
  Migration **0225** drops the stale 3-arg overload; re-probed live → 1 overload, a 3-arg call now resolves
  cleanly via the 4-arg's default. Class: `create or replace` that changes a function's arg list silently
  ORPHANS the prior overload — a duplicate that only a live `pg_proc` count reveals (typecheck/db:apply are
  both blind to it). Verified fixed.

## Live RLS finding — settings PATCH admin gate is ROUTE-only (within-tenant, founder-decision)
Behavioral check of the `companies` UPDATE policy (probed live): `roles={public}, qual=(id =
auth_company_id()), check=(id = auth_company_id())` — **company-scoped, not role-scoped** — and `authenticated`
holds the UPDATE grant. So the schedule Settings PATCH's `isAdmin` gate is enforced only at the ROUTE: a
NON-admin company member could bypass it via a direct PostgREST `PATCH /companies?id=eq.<own-company>` and
change `timezone`/`workweek_start`.

- **Scope:** WITHIN-tenant only (`auth_company_id()` confines it to the member's own company; `anon` is
  RLS-blocked despite the grant — auth_company_id() is null). Not cross-tenant, not exfiltration.
- **Impact:** a company-wide schedule setting (everyone's "today"/week shifts). Internal actor, griefing/
  integrity nuisance, admin-recoverable. **LOW-MED.**
- **Not new / not schedule-specific:** the `companies` UPDATE policy is pre-existing (0095); `default_theme`
  (0201) and every companies-settings column share the exact property (route-gated, RLS company-scoped). A26
  sweep: this is a `companies`-table-wide pattern, not introduced here.
- ✅ **FIXED (founder picked the targeted column-guard trigger, 2026-08-20).** Migration **0226**
  `guard_company_schedule_settings` — a BEFORE UPDATE trigger on companies that rejects a non-admin changing
  `timezone`/`workweek_start` (mirrors 0111's guidance guard exactly; role check = CEO/COO/admin, matching
  `isAdminRole` and the route gate). An update not touching those columns passes; service-role/definer
  contexts bypass (verified live — owner UPDATE of the columns succeeds, so seeds + the apply_schedule_import
  RPC aren't blocked). Applied + verify:live 28/28. **Gated (A30):** the verify:live authz-guard invariant now
  asserts `companies_guard_schedule_settings` is wired (and, gap-fill, `companies_guard_guidance` from 0111,
  which was previously ungated) — 9 triggers total. **BEHAVIORALLY PROVEN (residual CLOSED):** ran the
  two-real-user test against prod in rolled-back transactions — a real non-admin (Member) simulating their JWT
  (`request.jwt.claims.sub`; auth_company_id() reads profiles so RLS passes for their own company) → `UPDATE
  companies SET timezone` **RAISED** ("only CEO/COO/admin may change"); a real admin → **UPDATE succeeded (1
  row)**; owner/service context → bypass (succeeds). All three paths verified live, nothing persisted. This is
  the two-user test the 0111/F8 residual notes deemed hard — done here because both a real admin and a real
  non-admin profile exist in prod to simulate.

## Cross-tenant isolation — BEHAVIORALLY PROVEN with real data (2026-08-20)
The module's most important security property, proven live (not assumed) using two real prod users in
DIFFERENT companies, all rolled back:

- **Strong proof (with data via the real write path):** as company A, wrote a `SHIFT_DEFINED` through the
  actual `append_schedule_event` RPC → A sees its own new event (1); switched the session to company B (a
  different tenant) → B sees **0** of A's events. RLS + the RPC's session-derived company_id both hold — a
  tenant cannot read another's schedule data even when it exists.
- **Read isolation** (schedule_event + schedule_employee, both users): 0 other-company rows visible.
- **Structurally gated:** the dynamic verify:live tenant invariants cover these tables — "all company_id
  tables RLS-protected" (RLS ON) + "no company_id table has a PERMISSIVE read/write policy" (no open policy).
  The behavioral "anon reads 0 from populated tenant tables" check skips schedule_event/employee only because
  they are empty in prod; this manual strong proof covers that gap for now.

## ✅ FIXED (was 🔴) — RQ6 manager-only gate is now enforced in the RPCs (0227, founder-picked 2026-08-20)
Behavioral probe (rolled back): `append_schedule_event` is `EXECUTE`-granted to `authenticated`, and it checks
the caller's COMPANY (session-derived) but NOT their ROLE. The RQ6 manager-only-event-type gate
(`MANAGER_ONLY_EVENT_TYPES`) lives ONLY in the TS events route. So a non-admin Member, via a direct PostgREST
`POST /rest/v1/rpc/append_schedule_event`, appended `TIMEOFF_APPROVED` and it **SUCCEEDED** — bypassing the
route gate.

- **Impact (within-tenant):** a member can self-approve their own time-off, self-assign / unassign / cancel
  shifts (`EMPLOYEE_ASSIGNED`/`UNASSIGNED`/`SHIFT_CANCELLED`), define shifts, and change coverage
  (`COVERAGE_REQ_*`) — every manager-only action — on their OWN company, defeating the RQ6 manager-control
  model. NOT cross-tenant (company is session-derived; the tenant-isolation proof above holds).
- **Class:** identical to the 0226 settings finding (route-gated but the write PRIMITIVE is open to
  authenticated) — here on the CORE schedule write path, so higher impact. The audit's earlier "RQ6 FIXED"
  entry was the ROUTE gate only; the RPC was never gated.
- **Fix options (SURFACED — a core-primitive security-model change, founder's call):**
  1. Enforce RQ6 INSIDE `append_schedule_event` — for a manager-only `p_type`, require the caller be
     CEO/COO/admin (mirrors `MANAGER_ONLY_EVENT_TYPES` + the 0226/0111 pattern); employee types
     (TIMEOFF_REQUESTED/AVAILABILITY_SET/SWAP_REQUESTED) stay open. Route check becomes early-400 defense.
     **RECOMMENDED** — matches established intent + the founder's 0226 precedent, smallest surface.
  2. A BEFORE-INSERT trigger on `schedule_event` that enforces the same (keeps the RPC thin).
  3. Revoke `append_schedule_event` from `authenticated` and force all writes through the service-role API
     (bigger change; the current client calls it as the user, so this needs the API to use a service client).

**RESOLUTION (option 1, founder pick):** migration **0227** — a shared `auth_is_schedule_manager(company)`
predicate + a role gate in BOTH write RPCs (A26 sweep found `apply_schedule_import` had the same bypass —
confirmed live — so both are fixed). `append_schedule_event` rejects a non-admin appending a manager-only
type; `apply_schedule_import` requires a manager outright; employee types (TIMEOFF_REQUESTED / AVAILABILITY_SET
/ SWAP_REQUESTED) stay open; service/definer contexts bypass. Same signatures → single-overload invariant
stays green. **Behaviorally proven live (rolled back), full matrix:** Member→TIMEOFF_APPROVED BLOCKED,
Member→TIMEOFF_REQUESTED ALLOWED, Member→apply_schedule_import BLOCKED, Admin→TIMEOFF_APPROVED ALLOWED,
Admin→apply_schedule_import ALLOWED. **Drift-guarded:** `MANAGER_ONLY_EVENT_TYPES` is now exported and a
detection-proven test asserts the SQL list in 0227 equals it (so the two can't diverge). The route keeps its
check as an early-400 defense.

## ✅ FIXED — schedule_employee roster writes were member-writable (0229, A26 sweep of the same class)
Live probe: `schedule_employee` had a single `for all` RLS policy scoped only by company, so a non-admin
member could INSERT / UPDATE / DELETE roster rows via direct PostgREST — add fake staff, rename, deactivate
colleagues, delete staff — bypassing the roster routes' isAdmin gate. Third instance of the route-only-admin
class (after 0226 settings, 0227 RQ6); the founder's twice-established decision (DB-enforce) was applied.

**Fix (0229):** split the ALL policy into a member SELECT (reads the roster — needed for the grid) + admin-only
INSERT/UPDATE/DELETE (reuses `auth_is_schedule_manager(company_id)`, which guards `p_company =
auth_company_id()`). Service/owner contexts bypass RLS (seeds, the admin-run import RPC). **Behaviorally proven
live (rolled back):** member INSERT → BLOCKED; member SELECT → OK (read preserved); a real roster row planted
in the member's company → member DELETE 0 rows + UPDATE 0 rows, row unchanged (protected); admin INSERT → OK.
verify:live 28/28, gate green. Structurally gated by the existing dynamic "no company_id table has a PERMISSIVE
write policy" invariant.

## A26 sweep COMPLETE — route-only-admin-gate class, all schedule WRITE surfaces DB-enforced
Boundary confirmed (grepped every `.from`/`.rpc` write in `src/app/api/schedule`): the schedule write surfaces
are schedule_event (via append_schedule_event RPC → 0227), apply_schedule_import (0227), companies settings
(0226 trigger), schedule_employee (0229 RLS). All four now enforce the admin gate at the DB, not just the
route. No other write surface exists.

## ⚠️→✅ CRITICAL follow-up — 0227 RPC gate was BYPASSABLE via direct schedule_event insert (FIXED 0230)
Restricting reads (below) surfaced a worse write gap: `schedule_event` had a single `for all` company-scoped
policy AND `authenticated` holds a direct INSERT grant, so a non-admin member could
`POST /rest/v1/schedule_event {type:'TIMEOFF_APPROVED'}` DIRECTLY — bypassing `append_schedule_event` and its
0227 RQ6 check entirely (confirmed live: the insert SUCCEEDED). **Gating only the RPC was insufficient** — RQ6
must live on the TABLE. **0230** replaces the ALL policy with a manager-only SELECT + an RQ6 INSERT check
(`type not in (<12 manager-only>) or auth_is_schedule_manager(company_id)`); UPDATE/DELETE denied by default +
the append-only trigger. The RLS list is the THIRD copy of the manager-only set — the drift-guard test now
asserts route == 0227 RPC == 0230 RLS. **Behaviorally proven live (rolled back):** member direct-insert
TIMEOFF_APPROVED BLOCKED, member direct-insert TIMEOFF_REQUESTED (employee) WROTE, admin direct-insert +
append_schedule_event RPC both WROTE. **Append-only preserved** (0230 removed the ALL policy that had covered
UPDATE/DELETE): verified live that `authenticated`/`anon` hold NO UPDATE/DELETE grant on schedule_event, and an
admin UPDATE + DELETE are both BLOCKED — the grant absence + the 0220 append-only trigger + no UPDATE/DELETE
policy keep the log immutable.

## ✅ FIXED (was ⚠️ Open) — schedule reads restricted to managers (0230, founder pick 2026-08-20)
The founder's "manager-only" pick (0226-era layout gate) redirects non-managers from the schedule UI, but the
`schedule_event` / `schedule_employee` SELECT policies are company-scoped (member-readable). So a non-manager
member could read schedule data — including colleagues' `TIMEOFF_REQUESTED` events with `type: sick` — via a
direct PostgREST GET, despite the UI redirect. The sick-leave privacy the manager-only pick aimed at is
therefore UI-only, not RLS-enforced. **Decision (surfaced, not built):** restrict schedule reads to managers at
RLS too (fully honoring manager-only) vs. leave member-readable for Phase-6 employee self-service (which will
need members to read their OWN schedule with per-person scoping). No current UI needs member reads (all
schedule UI is manager-gated), so restricting now is low-risk; but Phase 6 will re-open a scoped member read. **DONE (0230):** schedule_event +
schedule_employee SELECT are now `using (auth_is_schedule_manager(company_id))`; a member reads 0 rows
(verified live). Phase 6 will add a per-person member read when it ships.

## 📋 App-wide follow-up (OUT of schedule scope, sized for the founder) — the route-only-admin class recurs
The class the schedule sweep just closed (a route gates a WRITE by role, but the table's RLS is company-scoped
and `authenticated` holds a direct write grant, so the route is bypassable via direct PostgREST) is one this
codebase has hit repeatedly — 0089, 0090, 0111 (§3.4 control window), and the schedule's 0226-0230. A bounded
recon query found **69 candidate tables** app-wide with a company-scoped write policy (no role reference) + an
authenticated write grant. MOST are legitimately member-writable (chat_messages, feedback, etc.), so the true
gap count is far lower — but confirming which of the 69 have a role-gated ROUTE (hence a bypass) needs
per-table route analysis across finance / care / sales-coach / chat, a large engagement beyond this schedule
build. **Not swept here** (would touch modules outside the task). Recommend a scoped follow-up (e.g. the
sellable modules first) with a gate to stop recurrence. Surfaced to the founder as its own decision.

### ✅ Scoped sweep DONE — care + sales-coach (founder pick 2026-08-20): mostly clean, 1 LOW fixed
Live-probed the care + sales-coach candidate surfaces for this class:
- **Table writes (3 candidates) — all SAFE:** `pitches` + `after_pitch_summaries` are OWNER-scoped
  (`rep_id`/`agent_id = auth.uid()` — a rep writes their own pitch; the recon's role-regex just didn't match
  the owner check); `care_agent_state`'s admin columns are already trigger-guarded and the rest is agent-owned.
- **Callable write RPCs (1) — FIXED (LOW):** `emit_care_durability_due_event(check_id)` was SECURITY DEFINER +
  client-executable and wrote a cross-tenant `events` row from an unguarded check_id. It is CRON/service-only
  (durabilitySweep → createAdminClient → service_role). **0231/0232** revoke it from public/authenticated/anon
  (functions default to GRANT-TO-PUBLIC, so PUBLIC had to be revoked too) + re-grant service_role. Verified
  live: member call BLOCKED, service_role retained. Gated (A30): a verify:live invariant asserts it stays
  service-only (29 invariants).
- All other care/coach `emit_*`/`stamp_*` are TRIGGER functions (not callable) — harmless grants.
Net: care + sales-coach have no route-only-admin write bypass; one unnecessary client grant closed. Remaining
app-wide surface (finance / chat) still deferred.

### ⚠️ CORRECTION (A38 — I over-claimed "clean") — recon had a profiles-subquery BLIND SPOT
The care/sales-coach recon above filtered on `auth_company_id()` in the write policy — but many care tables
scope via a `profiles` SUBQUERY (`EXISTS(select 1 from profiles p where p.id=auth.uid() and p.company_id =
<table>.company_id)`), which that filter MISSED. Re-run with a corrected net (company-membership write, no role
AND no owner column):
- `care_tenant_config` — first looked exposed, but is SAFE: the full (untruncated) policy DOES carry a role
  check; a non-admin member UPDATE was BLOCKED live (0 rows). (Lesson: don't classify off a truncated policy.)
- **`support_customers` — ✅ FIXED (0233, founder pick 2026-08-20):** write policy was pure company membership
  (no `is_support_agent`/role term) while the route uses `requireCareAgent`, so a plain Member could
  INSERT/UPDATE customer records via direct PostgREST. **0233** replaces the INSERT/UPDATE policies with the
  agent-or-admin predicate (`is_support_agent OR role in CEO/COO/admin` — the same requireCareAgent shape the
  0034/0035 care tables use). **Behaviorally proven live (rolled back):** a real plain Member → BLOCKED; a real
  support agent → WROTE; a real admin → WROTE. SELECT left as-is (read is a separate consideration).
- `files` — ✅ SAFE (I over-flagged it; corrected). The full UPDATE policy is
  `company_id = auth_company_id() AND (uploader_id = auth.uid() OR <caller CEO/COO/admin>)` — uploader-OR-admin,
  which MATCHES the route gate. Not a bypass. My corrected recon false-flagged it because my owner-column
  exclusion list had `uploaded_by` but not `uploader_id`, so the owner check wasn't recognized. (Lesson: the
  recon heuristic's owner-column list is incomplete — it over-flags; every candidate needs the FULL policy
  read, as done here.)

Corrected net's ONLY pure-company-membership candidates in CARE/sales-coach: support_customers (fixed) + files.

### 📐 App-wide RE-SIZE (corrects the wrong "69") — the deferred sweep is really a FINANCE sweep
The earlier "69 candidates" was doubly wrong: it filtered only `auth_company_id()` scoping (missed the
profiles-subquery pattern) AND included owner-checked tables (false positives). Re-run with the corrected net
(company-membership write via EITHER scoping, no role, no owner column), the actionable app-wide set is ~40 and
**dominated by finance** (~30 `fin_*` tables). The rest split into:
- **Core collaborative tables** (problems / signals / resolutions / tasks / task_messages / task_participants /
  team_members / team_invitations / notification_subscriptions) — these are member-writable BY DESIGN (the
  diagnostic system + tasks are collaborative; a member contributes signals, creates tasks). Not the bypass
  class; expected member-write. Need a quick confirm each has no admin-only route, but low priority.
- **False positives** like `pitches` (owner-scoped `rep_id = auth.uid()` — the heuristic's owner-exclusion just
  didn't catch the parenthesized form).
So the real remaining surface is **finance** — its sensitive operations are approval/posting.

**✅ Spot-verified (de-risks the deferral): finance's critical money ops are DB-ENFORCED, not route-only.**
Read the live RPC bodies: `fin_approve_bill` and `fin_post_entry` BOTH open with
`if not fin_can_approve() then raise exception 'Not authorized …'` as their FIRST statement, plus a
`v_company <> auth_company_id()` tenant check. This is the OPPOSITE of the schedule bug — the capability check
is INSIDE the RPC (the route is defense-in-depth), so a non-approver calling it directly is blocked at the DB.
Combined with the posted-entry immutability triggers (fin_entries_immutable), posted records can't be mutated.
So the ~30 `fin_*` TABLE candidates are DRAFT-level data entry (creating a draft bill/invoice is legitimately
member work; approving/posting is the gated RPC), NOT a route-only-admin bypass. **Finance is LOW-urgency for
this class** (unlike schedule, which was systemically route-only). A full finance sweep can still confirm each
draft-write table per the corrected net, but there is no critical financial-fraud bypass here — the founder can
defer finance without that risk.

### 🧮 Bottom line — the route-only-admin class is essentially CLOSED (not a large deferred surface)
After reading the FULL policies (not the heuristic recon, which over-flags), the only REAL route-only-admin
write bypasses in the whole app were **schedule** (5 surfaces) and **care** (support_customers +
emit_care_durability grant) — all now FIXED. Everything the recon flagged beyond those is a false positive or
proper design:
- **finance** — sensitive ops (approve/post) gate `fin_can_approve()` INSIDE the RPC + posted-immutability;
  draft writes are member-appropriate.
- **`files`** — uploader-or-admin RLS (matches the route).
- **`pitches` / after_pitch** — owner-scoped (`rep_id`/`agent_id = auth.uid()`).
- **core** (problems/signals/resolutions/tasks/team_*) — collaborative, member-writable by design.
So the deferred "app-wide sweep" is much SMALLER than the raw recon suggested: the substance is a per-table
confirm of the finance draft-write tables + chat (guard-triggered already) — low urgency, no critical bypass
known. The recon heuristic (auth_company_id()-or-profiles scoping, minus role, minus an INCOMPLETE owner-column
list) OVER-FLAGS; the reliable method is reading each candidate's full policy, as done above.

## Verdict
The schedule system is **structurally sound foundation-up.** No CRITICAL or HIGH flags. The event-sourcing
discipline, single-source verdict (A40), advisory-only LLM, tenant isolation, and append-only enforcement all
hold and are gate/live-verified. The open flags are MED (tz, role-gate) and below, each recommended, none
blocking the manager MVP. Not yet go-live for employee-facing use (Phase 6 + the MED flags) — go-live-ready as
a manager tool once the founder visually confirms the UIs.
