# Security audit — four-class sweep (2026-07-16)

Recorded per §1.7.4 (audits immutable + comparable). This session swept four attack-surface classes across the
API. Two yielded real fixes; two verified clean. Every "clean" was earned by inspecting the candidates (§1.7.3),
not asserted. A future security pass should compare against this baseline.

## 1. Session / route authorization — 1 FIX
- **`PATCH /api/coach/sales-session/[id]` rename** was authorized by `getSession` (company-visibility), the
  right bar for a *manager status transition* but wrong for a *rename* — any company member could relabel a
  colleague's session via a crafted PATCH (UI was owner-gated; API wasn't). **Fixed `6d7938d`** → owner-only
  (`existing.agentId === auth.uid()`), **tested** (`route.authz.test.ts`, 6). Full write-authz table:
  docs/closures/2026-07-15-elostate-coach-write-authz-audit.md.

## 2. Secret comparison (timing side-channel) — 1 FIX
- **`POST /api/care/durability-sweep`** compared its `CARE_DURABILITY_SWEEP_SECRET` header with a plain `!==`
  (short-circuits on first differing byte → timing leak). Every other secret-checking route uses
  `constantTimeEqual`. **Fixed `f5e82b1`** → constant-time; corrected `constantTime.ts`'s stale "3 sites" note
  to an explicit rule. **Class now uniformly constant-time**: durability-sweep(+cron), task-overrun(+cron),
  backfill-dissects-cron, finance deliver-cron, inbound-email webhook. `health`/`settings` only do
  `Boolean(process.env.*_API_KEY)` existence checks (no comparison).

## 3. Service-role routes (RLS bypass) — CLEAN (verified)
Every admin-client API route is authorized — via mechanisms an incomplete grep initially missed. Manually
inspected the highest-risk candidates:
- `files/[id]` → `getCurrentAuthContext` + explicit uploader/admin check on the admin path.
- `care/agent/tenant` → `requireCareAgent` (admin-only, company-scoped).
- `care/conversations/[id]/file/[fileId]` → session token → conv-id match → file-belongs-to-conv →
  `access_role === 'everyone'` (no cross-conversation/tenant leak).
- `care/tts` → `x-care-session` token → conversation resolve.
No ungated admin-client route found. (The one real service-role gap this session — the rename — is in class 1.)

## 4. LLM rate-limiting (cost-DoS) — CLEAN (verified)
Every route that actually invokes an LLM carries `rateLimit` (spot-confirmed after-pitch, cue). The two grep
flags (`health`, `settings`) make no LLM call — they matched the `ANTHROPIC_API_KEY` existence check.

## 5. CSV formula injection (CWE-1236) — CLEAN (verified)
Every CSV **exporter** routes user data through the neutralizer (`export/[entity]` via toCsv/csvSafe;
finance contractors / reports / statements). The two grep flags (`finance/banking`, `finance/cards`) are
CSV **importers** (`parseCsv` / statement upload → `/import`) — they read CSV, never write it, so
formula-injection (an export-opened-in-Excel attack) doesn't apply. Baseline rule: a new CSV EXPORT must
route cells through `neutralizeCsvFormula`; imports don't need it.

## 6. Signal-integrity (pre-activation) — 1 FIX (added same session, after wiring the task-overrun cron)
Wiring the dormant task-overrun sweep into `vercel.json` (`8bebaf5`) prompted a correctness pass on the
logic it fires. The candidate filter (0109) treated `status <> 'Completed'` as "still open", but 'Cancelled'
is also terminal (server transition map, `tasks/route.ts:214-219`) and reachable via a direct API PATCH
(the route validates status against the map, not the create-enum; `tasks.status` has no DB CHECK). So an
overdue **cancelled** task would emit a false `task_slipped` signal into the append-only §3.1 chain — §A25
(false match worse than a miss) polluting a §3.5 hard metric. **Fixed `7098820`** → migration `0184`
(create-or-replace both functions, `not in ('Completed','Cancelled')`, both the candidate query and the
emit re-check). **UNAPPLIED** — founder applies. Caught BEFORE first emission (cron dormant until
CRON_SECRET), so no historical false-slip to clean up. Verified by SQL reading + transition-map evidence,
NOT a unit test (the predicate lives in the DB function). Flagged same-class-lower-consequence, not fixed:
team-check nudge / staleness badge (`status === 'Completed'`) act on cancelled tasks; and the server
transition map allows 'Cancelled' while the create enum + web-UI map omit it (a source-of-truth split).

## 7. Duplicated status graph drifted → broken server guard — 1 FIX (same investigative thread)
Tracing the Cancelled question into the transition graph exposed a second, larger defect. The task status
transition map was declared TWICE — the client graph (operations/[id]/page.tsx, what the UI renders) and an
inline copy in PATCH /api/tasks ("audit findings 7+8: backend now enforces it"). They had drifted: the server
copy keyed a phantom `New` (nothing writes 'New'), OMITTED `To Do` and `Needs Review`, and its comment falsely
claimed it mirrored the UI. Result (AMD-006 L2): the server guard **rejected To Do → In Progress** — the most
basic transition — for the API/mobile consumers it was added to protect (`transitions['To Do'] ?? [] → []`).
The web UI dodged it only because `changeTaskStatus` writes status directly via the RLS client and never hits
the route (so the guard was simultaneously dead-for-UI and broken-for-API). **Fixed `f71eca8`** → one shared
`TASK_STATUS_TRANSITIONS` + `allowedTaskTransitions()` in statusLabels.ts, imported by BOTH sides so "server
mirrors UI" is structural; 6 tests lock it (incl. the To Do → In Progress regression). Behavior change flagged:
the route no longer accepts → 'Cancelled' (never should have; no UI/enum/label for it; no consumer used it).

## 8. FLAGGED (not fixed — needs a founder UX decision): the "Blocked needs a reason" guarantee is bypassable
Same "validation only on the path the UI doesn't use" class as #7, but here it makes the product state a
FALSE guarantee (§3.4 honesty-is-the-moat), so it's flagged prominently rather than silently patched.

**Evidence.**
- The rule "a task in Blocked must carry a blocker_reason" is enforced in exactly ONE place: PATCH
  /api/tasks (route.ts ~L170, "audit findings 7+8"). There is NO DB enforcement — `blocker_reason` is a
  nullable column (0001:42); the 0006 trigger only EMITS an event when it changes, never REQUIRES it.
- The task DETAIL page moves status via `transitionStatus → changeTaskStatus` (lib/data/tasks.ts), a DIRECT
  RLS-client write that never hits the route — so the enforcement is bypassed. The detail page has NO
  blocker_reason field at all (grep-confirmed), and its transition buttons DO offer 'Blocked' (from To Do /
  In Progress). Net: a user can put a task into Blocked with no reason, from the detail page, today.
- Meanwhile the board's own copy asserts the guarantee to users: operations/page.tsx:276 "any task in Blocked
  must carry a blocker_reason (the API rejects the transition without one)"; :345 "required if status='Blocked'".
  The System claims a property a real path violates — the exact "confident, well-formed failure" §0 targets.

**Scope — THREE bypasses confirmed; only ONE path enforces.** (verified this session, not assumed)
  - **POST /api/tasks (create)** — the MAIN task-creation path. route.ts:76-96 writes `blocker_reason:
    body.blockerReason ?? null` with NO Blocked-requires-reason check; the board's client submit validates
    only `title` (page.tsx:197). So creating a task directly as 'Blocked' with an empty reason succeeds. This
    is the biggest gap — the primary flow, not an edge case.
  - **Detail-page transition** — `transitionStatus → changeTaskStatus` direct RLS write, no field, offers
    'Blocked'. Bypass.
  - **Any API/mobile consumer** — same as POST.
  - **Only board EDIT (PATCH /api/tasks)** actually enforces it (route.ts ~L170).

**Root cause (deeper than blocker_reason).** The task route validates BY HAND — POST checks only `title`;
PATCH hand-rolls the transition/blocker checks reading `body` directly. `TaskCreateSchema` / `TaskPatchSchema`
(validate.ts) are **DEAD CODE — imported nowhere** (grep-confirmed). So the zod enums (status/priority) and
any schema-level blocker rule are NOT the runtime guard on either path; they only *look* like protection.
(NB: this session's enum single-sourcing — dfbfe39 — is still correct and harmless, but it hardened a schema
the route doesn't currently use; that's a reason to WIRE the schema, not evidence the route is guarded.)

**Why not auto-fixed.** The correct fix is COUPLED and parts are founder-domain (§3.3, don't overtake):
  1. **DB trigger** (universal enforcement, single-source pattern): raise if `status='Blocked'` AND
     `blocker_reason` null/empty — catches every writer (POST, PATCH, direct client, future mobile, SQL).
     Migration, founder-gated. Must NOT ship before (2)/(3) or it hard-errors the create + Blocked-transition
     flows with no way to comply. Pre-existing Blocked-with-null rows (if any) aren't retro-broken (trigger
     fires on write), but audit them first.
  2. **Board create**: block client submit when status='Blocked' && reason empty (the field already exists;
     just make it required), mirroring the API rule.
  3. **Detail-page reason collection**: add a reason affordance on transition-to-'Blocked' (no field today).
     The board's conditional-inline-field pattern is the precedent; a small modal is the alternative — a UX
     call for the founder, hence flagged not built.
  4. **Separately**: either WIRE `TaskCreateSchema`/`TaskPatchSchema` into the route via `readBody()` (so
     status/priority/blocker are validated once, declaratively) or DELETE them. Dead validation code that
     looks live is a landmine — a future dev may "rely" on it.
Recommended sequence: (2)+(3) client collection → (1) migration → apply together; (4) as its own cleanup.

## 9. FRESH-SURFACE (§1.7) — C.A.R.E Command Center metrics filtered on non-existent statuses — 1 FIX
Pivoted to a surface untouched this session (C.A.R.E read-path) and applied the sharpest lens from the task
work: a status-set metric drifting from its stated meaning. `fetchCareCommandStats` (care.ts) filtered
`openCount` on `["new","open","assigned","waiting"]` and `awaitingFirstReplyCount` on `status='new'` — but the
0034 enum is `open/in_conversation/awaiting_customer/resolved/closed`. 'new'/'assigned'/'waiting' DON'T EXIST,
so `openCount` collapsed to just 'open' (dropping every agent-engaged conversation — the count fell as an agent
claimed one, backwards) and `awaitingFirstReplyCount` was PERMANENTLY 0 (the dashboard's "most time-sensitive
number", dead, amber highlight never firing). **Fixed `10d769b`** → OPEN_CONVERSATION_STATUSES +
AWAITING_FIRST_REPLY_STATUS single-source; both probes + the doc comment + the two dashboard help strings
corrected; 5 regression tests. Verified isolated: no migration adds the phantom statuses, and every other
C.A.R.E site already used the correct vocabulary — the bug was localized to this one stats fn (written
separately against an assumed model). Baseline lesson: a metric's status filter must be checked against the
actual CHECK-constraint enum, not the prose — prose and query here were wrong TOGETHER.

## 10. FRESH-SURFACE (§1.7) — C.A.R.E "Resolution rate" undercounted archived-resolved conversations — 1 FIX
Continued into the C.A.R.E SLA/analytics readouts. `fetchSlaWithDurabilityReadout` — VERIFIED CLEAN (FRT math
correct; outcome domain held/reopened/inconclusive matches 0036 exactly; no phantom statuses). But the agent
analytics "Resolution rate" (resolved / total) counted its numerator as `status === 'resolved'`. Archiving a
resolved conversation sets status='closed' (overwrites 'resolved'), while `resolved_at` persists (0034 trigger
stamps on resolve, never clears). So a resolved-then-archived conversation left the numerator but stayed in the
denominator — the rate FELL the more a team archived resolved work (§3.4/§3.5 perverse signal on a hard metric).
**Fixed `25558ea`** → count `resolved_at !== null` (ever-resolved); byStatus distribution still keys off current
status (correct). 3 tests. Same class as the "Open tasks" overcount: count the PERSISTENT field, not the
transient status. Baseline lesson: a RATE metric's numerator must key off the durable event (resolved_at,
completed timestamp), never a mutable status that a later lifecycle step overwrites.

Fresh-surface audit tally (C.A.R.E read-path): 2 real fixes (command stats phantom-status #9, resolution-rate
#10), 1 verified-clean (SLA readout). Honest §1.7 outcome — flags AND solid findings both on record.

## Baseline note for the next pass
- New secret checks MUST use `constantTimeEqual` (enforced-by-convention; grep `!==.*secret|token|Bearer`).
- A rule declared in TWO places (client + server copy of the same graph/list) is a drift bug waiting to
  happen — the server transition map had silently diverged from the UI's for who-knows-how-long. Prefer ONE
  exported source both import (TASK_STATUS_TRANSITIONS, isTaskClosed, csvSafe are the pattern).
- A new "task is still open" predicate MUST exclude BOTH terminal statuses (`Completed`, `Cancelled`), not
  just Completed — especially any path that writes to the immutable §3.1 event/signal chain.
- New admin-client routes MUST gate the caller (user context / care-agent / session token / cron secret) AND
  scope every query to the caller's tenant.
- New LLM routes MUST carry `rateLimit`.
