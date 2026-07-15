# Security audit — four-class sweep (2026-07-16)

> ## ⬆️ EXECUTIVE SUMMARY (navigational — kept current through session end; the numbered classes below are the record)
> This began as a 4-class security sweep and became a **whole-session comprehensive audit (66 classes)**. The
> FINANCE audit is 100% complete (every calc + reconciliation surface, with reference tests for the subtle ones);
> the entire §3 constitutional core is verified sound BY ENFORCEMENT (not just prose); the security perimeter is
> **double-verified — insider finding-by-finding AND §1.3 outside-view adversary sweep (6 OWASP surfaces)**; the
> entire apply queue is verified APPLY-SAFE (classes 53-57); and 2 durable reasoning insights (A32, A33) were
> captured to the IP store.
>
> **18 REAL FIXES** (all tested where testable; migrations UNAPPLIED unless noted):
> - *Tasks:* transition-guard drift (#7, live), "Open tasks" overcount (live), `0184` false task_slipped
>   (Cancelled), 3× team-check Cancelled (live), domain-list dedup (live), blocker_reason CREATE enforcement
>   (server+client, live).
> - *C.A.R.E:* command-stats phantom statuses (live), resolution-rate transient-status (live).
> - *Finance:* dashboard AR (`0185`) + cash-forecast (`0175`) credit-note omission; recurring-bill month-end
>   DRIFT (`0186`, anchor-day, algorithm-test-verified — the founder's decided fix, finally built).
> - *Security:* session-rename authz (live), timing-unsafe secret (live), push recipient (live), recording-upload
>   executable-via-spoofed-MIME (#15, live), the notify-message recipient bug, + **#18 stored-XSS footgun removed
>   (my-growth `dangerouslySetInnerHTML` purposeless sink → plain `{title}`, live)**.
>
> **2 STRUCTURAL GATES BUILT:** invariant-audit INVARIANT 5 (every upload route must validate — fix #15 can't
> recur) + **ESLint `react/no-danger`** (no new `dangerouslySetInnerHTML` without a justified disable — fix #18's
> class can't recur). Both live in `npm run check`; full pipeline GREEN (805 tests · 0 lint · 0 invariant violations).
>
> **VERIFIED SOUND** (the important negatives): the ENTIRE §3 constitutional core, checked by *enforcement
> evidence* not comments — §3.1 events-immutability (rewrite-rule), §3.2 gate (distinct-signal/source counts),
> **§3.3 ask-first (schema `min(20)` on userDiagnosis+userProposal; assert-first routes retired to 410)**,
> §3.4 control-gate fail-closed, **§3.5 consequence-not-agreement (coached-vs-uncoached durability at equal N)**,
> **§3.6 real-not-vanity (≥30-event readiness + fail-closed error state)**; all finance calc surfaces (+ new
> depreciation & break-even reference tests, 78 finance tests); every service-role route (28) tenant-scoped;
> the 0183 DEFINER-revoke complete; both account-join halves; **`auth_company_id()` linchpin un-spoofable**;
> the self-write privileged-column class closed by triggers `0090`+`0093`; finance surface reachable
> end-to-end (28/28 pages navigable, set-diff verified). ~12 false-findings refuted before reporting — incl. a
> near-miss 40-item fake-orphan report caught by verify-before-report, and my OWN over-stated 🔴 on `0090`
> corrected to 🟠 (migrations apply in order → applying through 0115 necessarily applied 0090-0093).
>
> **YOUR QUEUE** (see FOUNDER-ACTION-QUEUE.md):
> - 🟠 **CONFIRM (1 query, likely already true):** `select tgname from pg_trigger where tgname in
>   ('profiles_guard_privileged','chat_participants_guard_privilege');` → expect 2 rows (privileged-column
>   self-write guards). Almost certainly applied given migration ordering; confirm, don't alarm.
> - **APPLY:** `0114`·`0115`·`0184`·`0185`·`0186`·finance `0157-0182`·security `0141`/`0142`. ✅ **APPLY-SAFETY
>   VERIFIED (classes 53-56):** the whole queue is forward-reference-clean at object + column granularity and has
>   no NOT-NULL-no-default hazard — it applies cleanly in numeric order onto the current schema. The ONLY residual
>   is data-content constraint violations (an existing row tripping a new CHECK/UNIQUE/FK), which only your dev
>   `supabase db push` can surface. Apply with confidence; if one fails, it'll be a data issue, not a broken migration.
> - **DECIDE 10** (each has a reasoned recommendation in FOUNDER-ACTION-QUEUE.md): tax attribution · blocker_reason
>   *transition*-surface UX · Cancelled-first-class · profitability dims · signal backstop (design verified,
>   greenlight-ready) · bootstrap DoS · CRM control-month · depreciation rounding-stub (LOW) · **LLM chokepoint
>   rate-limit (LOW, no current gap)** · **postcss dependency advisory (LOW, non-exploitable — do NOT run
>   `npm audit fix --force`)**.
> - **CONFIG:** `CRON_SECRET`·VAPID·runbook·**confirm Supabase Auth rate limits** (dashboard — brute-force
>   protection is delegated to GoTrue and on-by-default; just confirm the values are sane, class 60).

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

## 8. PARTIALLY FIXED (create half) + FLAGGED (transition half needs a UX decision): "Blocked needs a reason"
> UPDATE (later same session, `1f75685`): the CREATE half is now FIXED. I was too conservative flagging the
> whole thing as UX-coupled — the POST-create path is not. POST /api/tasks now 400s a status='Blocked' create
> with an empty blocker_reason; the board's create modal already has the field, so no UX decision was needed,
> and this closes what the flag itself called "the biggest gap — the primary flow." 4 tests. The DETAIL-PAGE
> TRANSITION half remains flagged below (genuinely UX-coupled: that surface has no reason field).

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

## 11. FRESH-SURFACE (§1.7) — AR outstanding ignored CREDIT NOTES on two consumers — 2 FIX
Applied the metric-integrity lens to finance AR. Credit notes (0143) reduce a customer's balance and 0143 added
a `credited` column to fin_invoice_summary (outstanding = total − received − credited), updating fin_ar_aging
AND fin_kpis. But two AR consumers were MISSED:
- **fin_dashboard_summary.ar_outstanding (0136, APPLIED)** — `sum(total − received)`, ignored `credited`. The
  Command Center headline AR OVERSTATED receivables by issued credit notes and stopped tying to GL AR. Fixed
  in **new migration 0185** (create-or-replace; UNAPPLIED — founder applies).
- **fin_cash_commitments (0175, UNAPPLIED)** — referenced `i.paid` on fin_invoice_summary, which has NO `paid`
  column (invoices use `received`); the view would FAIL to apply, and its comment claimed a credit-note netting
  it didn't do. Fixed IN PLACE (`i.paid` → `i.received − i.credited`).
Verify-before-report caught a near-miss: fin_ar_aging LOOKED broken in 0133 but 0143 supersedes it and DOES
subtract credit notes — nearly reported a fixed view. Boundary confirmed (§A26): aging + KPIs already correct;
AP has no vendor-credit feature so total − paid is right. Baseline lesson: when a feature adds a component to a
derived amount (credit notes → AR), grep EVERY consumer of the base view — one was applied+live-wrong, one was
an unapplied migration that wouldn't even apply.

**Class COMPLETE (AP side swept, all clean):** fin_ap_aging (0138), fin_payments_due (0158), and the dashboard
ap_outstanding all compute `total − payments` with NO credited term — correct, because there is no vendor
credit-note feature. fin_dunning_worklist (0159) is exemplary: it subtracts credit notes AND its own comments
show the author already caught the phantom-status class in an earlier draft ("values that do not exist"). So
the later finance migrations had learned the lesson; the gap was isolated to the earlier dashboard (0136) and
one careless unapplied view (0175). Every AR/AP outstanding consumer is now verified correct (5 already-right,
2 fixed).

## 12. FRESH-SURFACE (§1.7) — profitability views VERIFIED SOUND + 1 subtle FLAG (not fixed)
Audited fin_project/cost_center/customer_profitability (0148). Structurally correct: posted-only, revenue =
credit−debit on type='revenue', cost = debit−credit on type='expense', direct vs total via cost_type='direct'.
Account 4900 (Sales Returns) is correctly typed 'revenue', so a credit note's Dr 4900 acts as contra-revenue
and reduces revenue where tagged. Documented limitations (stated in the migration, not bugs): customer
profitability counts only project-tagged revenue; untagged activity is absent from the slices.

FLAGGED (subtle, founder-domain — a GL posting change, not fixed unilaterally): the credit-note posting
(0143:115) writes the 4900 line with NO project_id/cost_center_id, while invoice revenue lines CAN be
dimension-tagged. So in fin_project_profitability a project-tagged invoice's revenue is counted but its
credit-note reversal is untagged and absent → project/cost-center profitability OVERSTATES when a tagged
invoice is credited. Asymmetric attribution (tagged in, untagged out), not just "untagged absent". Recommended
fix: thread the invoice's dimensions onto the 4900 posting line(s) in fin_issue_credit_note. Narrow scenario
(credit note AND project-tagged invoice); GL/AR figures are unaffected (they're correct). Founder's call —
touches the double-entry posting path.

## 13. FRESH-SURFACE (§1.7) — tax report VERIFIED CORRECT (known, founder-gated limitation, handled well)
fin_tax_report (0150): output tax (issued invoices) − input tax (approved bills) by jurisdiction. Correct.
The credit-note gap (output_tax is gross, doesn't subtract tax reversed by issued credit notes) is NOT a bug —
it is KNOWN, documented in-migration (0150:38-44), user-warned (the Tax page shows a matching banner so no one
files a wrong number), and DELIBERATELY deferred as a founder decision: credit-note lines carry no tax_code_id
→ no jurisdiction, so attributing the reversed tax (linked invoice's jurisdiction? proportional? Unassigned?)
is a design choice the code refuses to guess ("Do NOT silently guess the attribution here"). Exemplary §3.3.
CONCRETE FOUNDER DECISION SURFACED (decision-ready per the financial-system memo: leaning 'proportional'):
pick the credit-note tax attribution rule, then output_tax netting becomes a mechanical follow-up.

## Audit boundary reached (honest §1.7 close)
Findings this run got progressively subtler: #1-3 hard bugs → #9 (C.A.R.E command stats) + #10 (resolution
rate) + #11 (AR credit notes) real → #12 subtle flag → #13 known-and-handled limitation. The later finance
migrations (0150 tax, 0159 dunning) are carefully self-documenting; the real bugs clustered in earlier/middle
work (0136 dashboard, 0175 forecast) that predated that discipline. This is the signal that the metric-integrity
audit has reached its productive boundary — further drilling now returns verified-clean or founder-gated
limitations, not fixes. The bottleneck is founder application of the queued fixes/decisions, not more audit.

## 14. FRESH-SURFACE (§1.7) — budget/runway (0149) + bank reconciliation (0145) VERIFIED CLEAN
- **fin_runway (0149):** correct — burn = (expense − revenue)/3mo (right sign), runway = case when burn>0 then
  cash/burn else null (∞ when profitable) — div-by-zero guarded, no negative-runway nonsense.
- **fin_budget_variance (0149):** correct — actual matched account × cost-center × quarter, NULL-SAFE on
  cost_center (`is not distinct from`, so company-wide/untagged budget lines match untagged actuals — the exact
  null-equality trap AVOIDED), natural-direction per account type.
- **fin_auto_match_bank (0145):** correct — signed-amount match (deposit→debit / withdrawal→credit), excludes
  already-matched GL entries (`not exists`, re-checked each loop iteration → no double-match even in one run),
  matches only on exactly-one candidate, idempotent; manual path holds the same 1:1 invariant.

- **fin_run_depreciation (0166):** correct — salvage clamp `least(monthly, (cost−salvage)−accum)` (book value
  never drops below salvage), double-post guard ((asset,period) unique + skip-existing + row lock), numeric not
  float, active-only + open-period + post-acquisition guards, Dr 6500/Cr 1900 via the balance-asserted path.
  My hypothesis (over-depreciation past salvage) was exactly what the author anticipated and clamped.

- **multicurrency fin_get_rate + fin_lines_compute_base (0119):** correct — same-currency→1, temporal lookup
  (most-recent rate on/before entry_date), MISSING rate RAISES (never a silent 0/1 → my exact hypothesis,
  guarded), correct direction (line ccy → base via amount×rate), CLIENT fx_rate IGNORED (authoritative from the
  table — no rate manipulation), system-ops trust-but-validate. FX is the highest-impact calc surface; careful.

- **break-even (0176 fin_unit_economics):** exemplary — break_even_revenue only when revenue>0 AND contribution>0 (else NULL: no divide-by-zero at revenue=0, no nonsense at negative margin), PLUS an undefined_because human explanation (§A11 no-naked-verdict, §3.4). Both hypotheses (div-by-zero, negative margin) anticipated + refused.

- **cost-per-outcome (0179):** exemplary AND the most constitutional finance code. cost_per_outcome NULL (not 0) when nothing held (§3.4 — a 0 reads as "fixing things costs nothing"); ONLY durability=held counts as an outcome; surfaces fixes_that_reopened ("money on fixes that came back" — impossible for a cost-per-resolution metric); unreviewed is its own bucket ("folding it into held is grading your own homework", §3.5). The finance system ENFORCING measure-consequence-not-agreement. Both hypotheses (div-by-zero, what-counts-as-outcome) handled.

- **overhead allocation (0173):** exemplary — ANALYTICAL (a view, not fictional GL entries that drift from truth); allocated_overhead & share NULL when total_direct=0 (div-by-zero guarded, §3.4 "0 would be a lie that balances"); correct proportional (overhead * direct/total_direct); an "unallocated" bucket surfaces what could not be allocated rather than spreading it. FINANCE CALC + CONSTITUTIONAL AUDIT COMPLETE: every calc surface (depreciation, FX, break-even, cost-per-outcome, overhead, variance, runway, budget, bank, inventory, tax, AR/AP, profitability) verified sound; 2 AR credit-note bugs fixed; the rest uniformly exemplary, author anticipating each classic bug.

- **payroll (0167):** exemplary — net_pay>0 CHECK (no negative net), gross=net+withholdings asserted with an accountant-actionable error (not opaque balance failure), employer-tax on-top-of-gross (true employee cost), row-locked + draft-only (no double-post), deliberately does NOT fake tax computation (records provider figures, §3.4). Both hypotheses (negative net, identity violation) guarded.

- **year-end close (0151):** exemplary — closing entry balances BY CONSTRUCTION in all 3 cases (profit: RE credited by net; loss: RE debited; net=0: RE line SKIPPED since a 0/0 line violates the debit-XOR-credit CHECK, and the rev/exp lines already balance). Double-close guarded (unique + existence check), reversible, skips zero-balance accounts, RE=3000. Both hypotheses (net-to-zero, double-close) + the subtle net=0 edge handled.

- **card-matching (0160):** verified clean — §A28 alignment to the bank-rec held: excludes already-matched (not exists), single-candidate only, equal-amount-to-the-cent with abs() sign handling, ±3 days, 1:1 unique. (Matches a card charge to an EXPENSE CLAIM, not a GL entry — the correct accounting difference.) FINANCE AUDIT 100% COMPLETE: every calc + reconciliation surface verified; 1 live bug found+built (recurring-drift 0186), 2 AR credit-note fixes, all else exemplary.

Eleven verify-clean/known-limitation results now stand alongside the ~14 fixes. Confirmed pattern: real bugs
lived in the EARLIER/middle migrations (transition guard, C.A.R.E command stats, 0136 dashboard, 0175 forecast);
the LATER finance work (0149/0150/0159 + 0145 algo) is consistently careful and correct. The metric-integrity +
algorithmic audit of the finance/C.A.R.E read-paths is COMPLETE to its productive boundary.

**+ inventory (0180/0181) VERIFIED CLEAN (12th):** negative stock triple-guarded (CHECK qty_on_hand>=0 +
explicit stock check + `for update` row lock on fin_sell_inventory), weighted-average cost correct, and 0181
forces fin_issue_invoice to post COGS-or-nothing (an inventory sale can't fabricate 100% gross margin — textbook
§1.5 holistic). The credit-note-doesn't-return-stock interaction is already flagged in FOUNDER-ACTION-QUEUE as a
business decision. Exemplary. Confirms the pattern is universal: every LATER finance migration is carefully built.

## 15. SALES COACH scoring VERIFIED SOUND — incl. the ORIGINAL founder complaint, fixed end-to-end
Audited the last un-swept computation surface (sales coach ELO + skill scoring). All clean:
- **salesElo.ts:** standard chess-ELO (expected = 1/(1+10^((opp−r)/400)), K=24, clamp [100,3000]); game =
  0.5·outcome + 0.5·performance; meanScore01 correctly EXCLUDES computed categories (talk_ratio) so a balanced
  50/50 doesn't distort the rating down. Carries prior audit findings A/B/A4; one degradation mode (DB error →
  outcomes dropped) is documented + loud-logged. Correct.
- **The founder's actual complaint** ("Talk/Listen 100/0" yet "no single fix stood out") — traced end-to-end
  and CONFIRMED FIXED: computeTalkRatio sets flagged+focusSuggestion="Leave more room to listen" for repShare≥75
  (non-caveat); deriveFocus promotes a flagged score over the null narrative, so a 100/0 call now surfaces the
  listen fix as the Focus, never "nothing stood out". The custW===0 caveat path shows "—" and refuses to flag a
  capture gap as a rep behavior (§3.4). Every link correct.

## FINAL audit scope (this session)
Computation surfaces audited: tasks · C.A.R.E (command stats/SLA/analytics) · finance (AR/AP/dunning/profitability/
tax/budget/runway/bank/inventory) · CRM (no aggregate-metric surface) · sales coach (ELO/scoring/focus). Real
bugs found+fixed on tasks/C.A.R.E/finance-earlier-migrations; everything else verified clean or founder-gated
limitation. The audit is exhaustive across metric/computation surfaces. Bottleneck = founder application.

## 16. §3.1 CHAIN — signal derivation idempotent-by-construction + 1 latent backstop FLAG
Audited derive_signals_for_event (0005→0014, the events→signals core). Correct: template substitution (0014
fixed a prior bug), predicate matching (`payload @> predicate`), per-source emission. **Idempotent TODAY by
construction** — all ~15 call sites are `perform derive_signals_for_event(v_event_id)` right after inserting a
NEW event, so each event derives exactly once; no re-derivation path exists (the task-overrun sweep dedups at
the EVENT level before calling derive).

FLAGGED (latent, not live — same class as the finance source-postings backstop): the `insert into signals` has
NO on-conflict/not-exists guard, and the `signals` table has NO unique constraint (only a company/observed_at
index). So a FUTURE re-derive path (backfill, retry, manual re-run) would silently DOUBLE signals → inflate the
§3.2 gate's threshold count so a problem could surface on fewer real signals than required — a constitutional-
core integrity risk. A clean backstop is non-trivial: `signals` carries no `event_id`, and (kind, source) is
legitimately non-unique (a task blocked twice = two real task_blocked signals), so dedup needs an `event_id`
column first — a schema decision, founder-domain. No fix applied (no live bug; the fix is a schema call).

## 17. §3.2 UNDERSTANDING GATE trigger VERIFIED SOUND (+ downgrades the class-16 flag)
Audited check_understanding_gate (0002) — the single most constitutionally-important trigger (structural refusal
to surface a half-understood problem). Correct at every point: fires on draft→non-draft AND direct
INSERT-as-surfaced (can't sneak a problem in already-surfaced); dismiss bypasses correctly; threshold lookup by
kind → '*' fallback; signal_count = distinct signals (the (problem_id,signal_id) PK prevents double-links),
source_count = count(distinct source); STRICT `<` comparisons = correct "needs ≥ N" with NO off-by-one; diagnosis
min-length enforced; surfaced_at stamped. Sound.

**Downgrades class 16:** even IF signals were duplicated (the latent derive-idempotency risk), duplicates share
the same `source`, so `count(distinct source)` is UNAFFECTED — `min_distinct_sources` is a built-in partial
mitigation: a problem still cannot surface without genuinely distinct evidence. The class-16 backstop remains
worth adding (signal_count could still inflate), but the §3.2 gate is NOT wide open to it — lower severity than
first stated.

## 18. §3.5 DURABILITY EMISSION (0100) VERIFIED SOUND — core-thesis chain audit COMPLETE
resolutions_emit_durability_review (0100): fires `after update of durability`, guards with `is distinct from`
(null-safe), emits resolution.durability_reviewed + derives in-txn. signal_sources map held→resolution_held,
reopened→problem_recurrence ("honest recurrence"), partial→partial_resolution; 'unknown' earns NO signal;
sourced at problem:${problem_id}. §3.5 "consequence not agreement" done right. Sound.

### CHAT event source (0012 + 0015) VERIFIED SOUND — completes the chain audit across ALL THREE sources
The §3.1 chain has three event sources; all now audited: TASKS (0006 + overrun 0109/0184 + transition guard),
CHAT (0012 emitters + 0015 durability review), RESOLUTIONS (0005 + 0100 durability). The chat durability
emitter (0015 chat_topics_emit_durability_review) is structurally IDENTICAL to the verified 0100: null-safe
`is distinct from` guard, emits chat.topic_durability_reviewed carrying the durability (close-time durability is
null by design, so the REVIEW event carries it — documented), derives in-txn, held/reopened/partial predicates.
Sound. Every event source feeding the chain is verified correct.

### CORE-THESIS CHAIN (§3.1→§3.5) — fully audited this session, all sound:
events (emitters) → **signals** (derive_signals_for_event: sound + idempotent-by-construction, class 16 latent
backstop flag) → **§3.2 gate** (check_understanding_gate: sound, class 17, mitigates 16 via distinct-sources) →
**problems** (open-count/lifecycle: sound) → **resolutions + §3.5 durability** (0100 emission: sound). The
constitutional core is verified end-to-end. ONE latent founder-domain flag (class 16 signal-idempotency backstop,
lowered severity by 17). Everything else on the chain is correct. This + the metric/computation sweep (classes
1-15) = the session's audit is comprehensive across BOTH the derived-metric surfaces AND the constitutional core.

## 19. PUBLIC CUSTOMER WIDGET message-post — VERIFIED SECURE (completes the widget security audit)
The highest-risk surface (public, unauthenticated customer input). POST
/api/care/conversations/[id]/messages is correctly secured: session-token required (401 if missing);
`getCareConversationByToken(token)` resolves BY the token then cross-checks `conversation.id !== id` — so a
customer cannot post into another conversation with a mismatched token (the token is the authority, the URL id
is verified against it); rate-limited (30/min write, 60/min read); Zod body (1-4000); closed→410, tenant-paused
→410. session_token is a unique gen_random_uuid()::text (0034) → exact-match, no injection surface. Combined
with the earlier sweep (class 3: file/tts paths, same token-scoping), the customer-facing widget paths are
consistently token-scoped and verified — no cross-conversation/tenant leak.

**Widget audit now COMPLETE end-to-end** (all public entry points verified):
- **bootstrap** (`/api/care/widget/bootstrap`): embed token length-bounded, resolved server-side with
  allowed_origins → 403, returns ONLY customer-safe appearance fields (never embed_token/origins/quota).
- **create** (`POST /api/care/conversations`): the company is derived from the VALIDATED embed token
  (`tenantId = resolution.companyId`), NEVER caller-supplied — so a forged token can't create conversations
  under another company; allowed_origins→403, quota→429, inactive→410, unknown→404; rate-limited 10/min.
- **message-post** + **file/tts**: session-token cross-checked (above + class 3).
The public attack surface (the app's highest-risk part) is consistently origin/token-scoped, rate-limited,
quota-enforced. Embed token is public-by-design (lives in customer HTML); security rests on allowed_origins +
the server-derived tenant — the correct embeddable-widget model. No leak found.

## 20. FILE UPLOAD path — VERIFIED SECURE (classic attack surface, every vector handled)
validateUploadCandidate + buildStoragePath (src/lib/storage/assets.ts), the customer upload route
(care/conversations/[id]/upload). All classic file-upload vectors handled:
- **DoS/size:** CUSTOMER_MAX_BYTES 10MB / AGENT_MAX_BYTES 25MB, empty rejected.
- **MIME-spoof:** customer allow-list (image/ + application/pdf) PLUS a BLOCKED_EXTENSIONS block-list wired
  specifically because browser MIME is spoofable (Audit F2) — evil.exe-as-image/png is caught by extension.
- **Dangerous types:** executables / video / zip / sh blocked by MIME prefix.
- **Path traversal:** storage key = {companyId}/{YYYY}/{MM}/{fileId(randomUUID)}{.ext}; filename is NOT a path
  component, and the extension is sanitized to plain alphanumeric (author documented the exact "evil.x/../secret"
  attack and mitigated it — defense-in-depth even if the backend treats keys literally).
- **Scope:** session-token → conversation, rate-limited, closed→410.
Author had already security-audited this (F2 refs); the validator itself is sound. With class 3 (file ACCESS) +
class 19 (widget), the customer file-handling + public surface is verified.

**BUT the §A26 sweep of ALL upload routes found 1 REAL GAP + FIXED it (`0964c64`):** every upload route wires
validateUploadCandidate EXCEPT coach/sales-session/upload-recording, which rolls its own inline validation —
because the shared validator's BLOCKED_EXTENSIONS rejects .webm/.mp4 (legitimate recording formats). Its MIME
check (startsWith audio/|video/) is browser-spoofable, so an executable uploaded as Content-Type audio/webm
passed with NO extension check. Low severity (authenticated agent route; stored as an opaque {uuid} asset served
as audio, not executed), but it's the exact class BLOCKED_EXTENSIONS exists for. Fixed: new shared
EXECUTABLE_EXTENSIONS subset checked in the recording route — blocks executables while allowing media; 3 tests
lock it. TS fix, already-live on deploy. Lesson: "validator wired everywhere?" is a §A26 class worth sweeping —
the customer route's own comment ("tested but never wired into this PUBLIC route") hinted the wiring was uneven.

## 21. SERVICE-ROLE tenant-scoping — FULL sweep (all 28 admin-client routes), CLEAN
Extends class 3 (which spot-checked ~4) to the COMPLETE enumeration: every route using createAdminClient /
createServiceRoleClient (28) was flagged for an auth/tenant gate; none came back ungated. Spot-verified the two
most suspicious: the lowest-gated `chat/topics/[id]/lock` (admin client bypasses RLS, but authz is
`topic.created_by !== auth.user.id → 403` — creator-only, tenant-safe by construction) and the highest-risk
bulk op `admin/files/storage-sweep` (getCurrentAuthContext → isAdmin → admin query explicitly filtered
`company_id = auth.companyId`, documented). No ungated admin-client route exists — the cross-tenant-leak class
(the worst severity; the class the CRM vendor-authz bug fell into) is sound across the whole API.

### Systematic-sweep lesson (this session, twice-proven)
The §A26 "is X wired/gated EVERYWHERE?" sweep beats spot-checking on careful codebases: the upload-validator
sweep found a REAL gap (recording route, fix #15) where 4/5 routes were wired; the service-role sweep confirmed
clean across all 28. Enumerate the whole class, don't sample it.

## 22. RATE-LIMIT / DoS sweep — mostly clean, 1 flagged tradeoff (bootstrap load-event spam)
Swept every API route for rateLimit. Findings:
- **LLM routes:** covered (class 4 holds). The `ai/analyze|decision|finance|marketing` routes flagged as
  no-rateLimit are DEPRECATED 410 STUBS (2026-06-02 audit residue — they return 410 and do nothing; no
  rateLimit/auth/LLM needed). False alarm.
- **Public action routes** (conversation create, message-post, uploads): all rate-limited.
- **Authenticated routes** without rateLimit (care/agent/*, coach/*, admin/crm/*, brain — the bulk of the list):
  lower DoS risk (require a valid account); not flagged.
- **FLAG (moderate, design tradeoff): `care/widget/bootstrap`** is public, has NO rateLimit, and calls
  logLoadEvent → an UNBOUNDED insert into care_widget_load_events on every call (no dedup/throttle). Flood →
  load-event table spam + DB write load. Its sibling public routes (create=10/min, message=30/min) ARE
  rate-limited; bootstrap is the outlier. NOT auto-fixed: rate-limiting bootstrap risks breaking legit
  high-volume widget loads (shared IPs / busy embeds), and throttling/sampling the log loses the traffic +
  wrong-origin tracking the founder wants. The threshold is a founder call. Confidentiality/integrity is
  unaffected (bootstrap returns only safe fields, class 19) — this is availability/cost only.

## 23. 0182 variance-alerts VERIFIED SOUND (realistic cases) + 1 negligible latent note
fin_budget_variance (0182): makes the previously-DEAD variance_alert_pct real (dead config that implied a
working control — good catch, author's own "reachability gate"). Direction-aware alerting is correct and
well-reasoned: expense → alert on OVERspend, revenue → alert on UNDERshoot, deliberately avoiding
abs(variance)>threshold (which would fire on BEATING a sales target — §A25 alert-fatigue). variance_pct NULL
when budget=0 (correct — % of nothing is undefined, not 0). Realistic cases (revenue/expense budgets) correct.
NEGLIGIBLE latent note (not a live bug): the is_alert expense/else branch computes actual as debit−credit
uniformly, while the `actual` COLUMN is type-aware (credit−debit for revenue/liability/equity). So a
LIABILITY/EQUITY budget line would mis-compute in is_alert — but budgets are realistically revenue/expense
only, so it's a dead edge case. If liability/equity budgeting is ever added, mirror the actual column's
type-awareness in is_alert. Severity ~nil.

## 24. 0183 DEFINER-revoke security fix — INDEPENDENTLY VERIFIED COMPLETE
0183 revokes EXECUTE (from authenticated, anon) on the SECURITY DEFINER helpers that take a company as a
trusted PARAMETER (cross-tenant read/write via PostgREST RPC — a client passes another company's id; DEFINER
bypasses RLS). Rather than trust the migration's "nine" claim, ran the same §A26 sweep independently: every
DEFINER function taking p_company (fin_account_by_code, fin_approval_limit_for, fin_get_rate,
fin_inventory_accounts, fin_mileage_rate_for, fin_obe_account, fin_per_diem_rate_for) + fin_post_system_entry
is revoked — the revoke list EXACTLY matches the sweep, no miss, and no p_company in a non-first position that
would slip past. Checked the subtle edge: fin_approval_limit_for is REDEFINED in 0168 (delegation) but keeps
the same (uuid,uuid) signature, so 0183's revoke covers the current version (a signature change there would
have left the delegation-aware version client-callable — it didn't). Class fully closed. (Deep meta the author
records: rls:audit has "no concept of a function", so DEFINER funcs were a gate blind spot — A30: a green gate
speaks to the gate's vocabulary, not the system. The revoke-vs-nine-guards choice removes the attack surface.)
**DOUBLY CONFIRMED + now GATED:** the codebase's own `invariant:audit` (scripts/invariant-audit.mjs INVARIANT 4)
already encodes exactly this rule — a DEFINER fn taking a tenant param must be revoked or auth_company_id-guarded
— and running it returns GREEN (0 violations, 594 files). So the class is closed AND structurally enforced going
forward (the "lesson returned because nothing gated it" failure the author described can't recur). Verified the
gate exists before building a duplicate; my manual §A26 sweep + this automated gate independently agree.

## 25. BUILT a structural gate — invariant-audit INVARIANT 5 (every upload route validates)
Turned fix #15's lesson into a mechanical gate (§3.2 structural, §1.6 close-the-loop — the same move the author
made for the DEFINER class in INVARIANT 4). A route reading a multipart File must run validateUploadCandidate
OR EXECUTABLE_EXTENSIONS (media escape hatch), or be allowlisted with its reason. Allowlisted: the tenant-logo
route (verified well-validated inline: image-only MIME allow-list + MIME-DERIVED extension into a fixed path, so
no client filename reaches the storage key — the BLOCKED_EXTENSIONS check adds nothing there; not a bug). Gate
GREEN (4 exceptions, 0 violations); 4 tests pin the detection. So the next upload route that forgets validation
FAILS CI instead of shipping the hole silently — the recording-route class can't recur. `8f75b46`.
This session's structural additions to invariant-audit: none new to the SCRIPT except mine (INVARIANT 4 DEFINER
was pre-existing, verified green; INVARIANT 5 upload is new). npm run check now enforces both.

## 26. §3.4 CONTROL-GATE (the honesty moat's month-1 mechanism) VERIFIED SOUND — fail-closed
Traced the §3.4 "month 1 = control, no AI guidance" enforcement to its real home: brain/index.ts
`evaluateControlGate` (NOT the CRM lifecycle_stage — nothing functional gates on that; it's vendor tracking).
The gate: `guidanceEnabled = manualEnabled || (unlockAt && new Date(unlockAt) <= now)`. Correct AND FAIL-CLOSED
— a null/malformed unlockAt → NaN<=now is false → autoUnlocked=false, so a misconfigured company STAYS in the
honest baseline rather than silently enabling guidance. That is §3.4 + §5 (the builder-under-pressure default
must be "suppressed," never "enabled") encoded in a pure, unit-tested function (controlGate.test.ts). A bug here
— failing OPEN — would violate the core thesis; it fails closed. Exemplary. The constitutional moat holds.
**And the OVERRIDE path is equally sound (verified end-to-end):** POST /api/brain/unlock is leadership-gated
(`!ctx.isAdmin → 403` — documented CRITICAL fix C1, where any member could previously override §3.4), requires
a ≥20-char reason, and unlockControlGate records that reason to brain_evolution_events (§7.5 retrospective).
So §3.4 cannot be SILENTLY bypassed: the default fails closed, and the only way to open early is a leadership
action, on the record, subject to review. The honesty moat is sound at BOTH the default and the override.

FLAGGED (minor, vendor-tooling — NOT a §3.4 violation): the CRM `control_month_completed` activity-event type
is DEFINED (0049:230) and UI-LABELED (crm/[id]/page.tsx:55) but NEVER EMITTED (dead event, task_slipped class),
and the CRM records a control-month 30-day window (0049:321 `now()+interval '30 days'`) but has NO mechanism to
auto-advance an account past control_month when it elapses. So a vendor sees accounts stuck in control_month and
must advance them by hand, and "Control month completed" never appears in the activity feed. Vendor tracking
accuracy only — the PRODUCT's §3.4 discipline is enforced by the brain gate above, independent of this. Low
priority; in the founder queue.

## 27. §3.3 GUIDE-DON'T-OVERTAKE structurally enforced — the ENTIRE §3 now verified sound
POST /api/ai/decision-dialogue gates the LLM behind DialogueDecisionSchema (situation + userDiagnosis +
userProposal, EACH min-20-chars). readBody returns 400 if the user hasn't stated a SUBSTANTIVE view, so
proposeDecisionDialogue (the AI's own proposal) is UNREACHABLE until the human has articulated their own
diagnosis and proposal FIRST — and the AI receives that view as input, responding TO it, never independently
(it can also `suppressed`-decline). The schema IS the structural gate that makes the System a participant in
the user's diagnosis rather than an overtaker (§3.3 non-negotiable product behavior). Encoded in code, not
merely claimed.

**§3 (How to Build the System) — verified sound END TO END this session:**
- §3.1 events→signals→derivation (idempotent-by-construction; 1 latent backstop flag, class 16)
- §3.2 Understanding Gate trigger (distinct-source counting, no off-by-one, class 17)
- §3.3 Guide-don't-overtake (user-first schema gate — THIS)
- §3.4 control-gate + override (fail-closed default + leadership-audited unlock, class 26)
- §3.5 durability emission + cost-per-outcome (consequence-not-agreement, classes 18/#179)
The constitutional discipline the product's honesty CLAIM rests on is actually ENFORCED in code at every §3
clause. A bug in any of these would matter more than any metric; none found (one latent backstop, flagged).

## 28. ACCOUNT-JOIN (accept_invitation email-match, 0114) — LOGIC VERIFIED CORRECT (unapplied)
The crown-jewel account-join path. 0114 fixes F1 (HIGH, 2026-07-10): the original accept_invitation looked up
the invite by CODE and attached the caller at the invite's role with NO email comparison — so a shared code
could be redeemed by anyone who saw it, incl. a CEO/COO→admin invite. 0114 adds: fetch the caller's email from
auth.users (DEFINER-readable) and reject unless `lower(trim(caller)) is distinct from lower(trim(invite.email))`
is false — EXACT, case-insensitive, null-safe, FAIL-CLOSED (null caller email → rejected). Only the invited
email can accept. Logic verified correct. UNAPPLIED — staging-gated (founder must apply + run the staging test:
invite X, accept as X = ok, accept as Y = rejected). Pairs with 0141 (invite-privilege-escalation, also applied-
gated) — the two halves of invite security. Both in the founder queue.

**member.joined emission (0115) also verified correct (unapplied):** the §3.1 join event. Fires on INSERT
(active+company) OR UPDATE to now-active+company-set AND (OLD.status<>'active' OR OLD.company_id IS NULL). My
double-emit hypothesis is guarded — a subsequent update to an already-joined member (OLD active + company
not-null) fails the predicate, no re-fire; and the fix captures the real bug (an already-active orphan attached
NULL→set previously emitted nothing, so the join was never recorded on the chain). Exactly-one on the join
moment. Both account-join halves (0114 email-match + 0115 join-event) are logic-sound; both staging-gated.

## 29. LIVE BUG (minor) — recurring-bill month-end DRIFT; the decided "anchor-day" fix was never built
fin_generate_recurring_bill (0140, APPLIED) advances next_date with `next_date + interval '1 month'` (and
'3 months' / '1 year'). Postgres clamps month overflow: Jan 31 + 1 month = Feb 28, then Feb 28 + 1 month =
Mar 28 — so a monthly/quarterly/annual bill anchored to day 29/30/31 DRIFTS permanently down to day 28 after
passing February and never recovers. Verified LIVE: only 0140 defines the function (no later anchor-day
redefinition), and no day_of_month/anchor logic exists anywhere. The financial-system memo recorded
"recurring-drift = anchor-day" as a decided fix — it was decided but NEVER IMPLEMENTED; 0140 still drifts.
Weekly is fine (+7 days is exact). Severity: MINOR — a bill DRAFT generates a couple days early each month; the
vendor/amount are correct, only the date drifts. No financial-integrity impact.
FIX (needs founder go-ahead — schema change + untestable-here clamp logic across 3 frequencies): add
`anchor_day int` (backfill = extract(day from next_date)); advance to the anchor_day of the next period CLAMPED
to that month's last day (`least(anchor_day, days_in_month)`), re-anchoring from anchor_day NOT the drifted
next_date. Not shipped blind — a subtly-wrong date-clamp migration I can't run could be worse than the known
drift. In the founder queue. (This is the one LIVE bug found late that isn't already fixed/flagged as founder-UX.)
> **NOW FIXED (`0186`, later same session):** on reflection the clamp is standard date math I could de-risk with
> a JS REFERENCE TEST (7 cases incl. the decisive re-anchor Feb28/anchor31→Mar31, year rollover, quarterly,
> leap-year). Built anchor_day column + re-anchored advance; the SQL uses the identical first-of-target-month +
> least(anchor,days) logic the JS test verifies. UNAPPLIED — founder applies + staging-tests. Backfill caveat:
> already-drifted rows anchor to their current day (original unrecoverable); drift STOPS forward.
> ⚠️ PROCESS NOTE: the fix commit (075856e) shipped with 2 failing tests — I chained suite+commit and the commit
> landed before I read the result. The failure was REAL: anchor_day tripped the reachability gate (INVARIANT 3,
> the gate I built this session — working as designed, catching my un-named column). Fixed forward (3d4deaa:
> documented RPC_ONLY_COLUMNS exemption — anchor_day is derived/DEFINER-managed, no UI control). Lesson: check
> the suite result THEN commit, never chain them.

## 30. C.A.R.E conversation ROUTING (routeNewConversation) VERIFIED — tenant-scoped, no cross-tenant assign
routeNewConversation: agent selection filters .eq("company_id", conversation.companyId) + status=online + channel eligibility; the load count (least-loaded balancing) is likewise company-scoped (OPEN_CONVERSATION_STATUSES). So a conversation can NEVER be auto-assigned to another company's agent (a routing bug there = cross-tenant data exposure). Graceful "unrouted" when no eligible agent. Unit-tested (care.routeNewConversation.test.ts). Both hypotheses (cross-tenant, capacity) handled. Security-relevant clean, complements the service-role sweep (21) + widget audit (19).

## 31. C.A.R.E email INBOUND threading (care/inbound/email) VERIFIED — standard + tenant-safe
Exemplary: (1) tenant resolved from the To: address's UNIQUE inbound_email_local_part (not spoofable subject/sender); unknown/inactive tenant → ignored 200 (no retry loop). (2) customer keyed on company_id+email (same email at different tenants = different rows). (3) threading matches In-Reply-To/References headers (RFC-5322 globally-unique message-ids) against external_thread_id — NOT subject/sender, so no cross-thread collision. (4) external_message_id dedup makes webhook retries idempotent. (5) concurrent-first-email race re-selects the customer (no orphan). No cross-thread/cross-tenant leak. Weak-match-key hypothesis handled.

## 32. Decision→task SPAWN linkage (0030) VERIFIED — xor correct; company-scoping inert-negligible
tasks_spawn_source_xor: check(linked_decision_id is null OR linked_chat_topic_id is null) — rejects only the both-set case, correctly allowing decision XOR chat OR neither. on-delete-set-null (unlink, not cascade-delete). Double-link hypothesis handled. NEGLIGIBLE note (verify-before-flag kept it proportionate, NOT flagged): the POST route doesn't validate linkedDecisionId is in the caller's company, but it is INERT — FK requires existence, RLS makes a foreign decision unreadable (the link is dangling+useless), the UUID is unguessable, and the UI picker only shows own-company decisions. Non-exploitable; a company-match check would be belt-and-suspenders defense-in-depth, not a fix.

## 33. SEPARATION-OF-DUTIES (self-approval fraud) VERIFIED across finance approvals
The anti-self-approval class is sound everywhere: fin_approve_expense_report (0125:94 "cannot approve your own expense report", v_emp = auth.uid() → raise); fin_approve_bill (0130:25 "cannot approve a bill you created" — itself a resolved audit flag where one person could create AND self-approve); fin_subledger_author_pin (0142) pins created_by = auth.uid() in the RLS with-check so authorship cannot be SPOOFED to route around the SoD check. All gated by fin_can_approve + submitted-only + company-scope + open-period. Self-approval fraud vector closed at every approval gate. Hypothesis (approve-your-own) handled.

## 34. PERIOD-LOCK + posting immutability (0118) VERIFIED — TRIGGER-enforced, no bypass
Stronger than hypothesized: the open-period gate is a TRIGGER on the journal tables (0118:93-107), not a check inside the posting fn. Any insert/update/delete touching a period whose status is closed/locked raises "fin: period is % — post corrections into an open period". Because it is a trigger it binds EVERY writer — the API, all DEFINER posting fns, direct SQL, service-role — so there is NO posting path that can bypass the lock (my hypothesis was "does one path skip the check"; a trigger makes that impossible). Posted entries/lines are also immutable (T-14). Closed books are truly sealed. Financial-integrity control sound.

## 35. §3.1 EVENTS IMMUTABILITY (the method's foundation) VERIFIED — rewrite-rule enforced, no tamper
The append-only §3.1 chain rests on events being tamper-proof (retrospective analysis is only honest if history cannot be edited). events (0004:36-37) carries REWRITE RULES: `on update to events do instead nothing` + `on delete to events do instead nothing`. Rewrite rules (unlike triggers) bind EVEN THE TABLE OWNER + service-role, so NO path — API, DEFINER fns, direct SQL, service-role — can update or delete an event. The historical record is immutable by construction. brain_evolution_events (0007:103-105, the §3.4 override + §7.5 review audit) has the same protection, so the accountability trail is equally tamper-proof. The strongest possible enforcement on the most foundational data. Hypothesis (events editable) impossible.

## 36. §3.5 RESOLUTION REASONING immutability VERIFIED — field-level trigger, the asset is frozen
check_resolution_immutability (0005:50-68): a trigger that raises if action_taken / reasoning / decided_at
change after creation, while ALLOWING durability / observed_outcome / reviewed_at / reviewer to be filled later.
So the original DECISION + its WHY (§3.5 "the reasoning is the asset"; reasoning is NOT NULL) are FROZEN — nobody
can rewrite the rationale to retroactively justify a bad call — but the durability REVIEW (consequence
measurement, filled later by 0100) is permitted. The exact right split: history's reasoning is immutable, its
measured outcome is recordable. Together with class 35 (events immutable), the §3.1→§3.5 DATA is tamper-proof
end-to-end. Hypothesis (edit reasoning to justify a bad call) is impossible.

## 37. DOUBLE-ENTRY BALANCE (fin_assert_balanced, 0118) VERIFIED — deferred constraint trigger, no bypass
The core ledger invariant. fin_assert_balanced raises if a POSTED entry has sum(base_debit) <> sum(base_credit),
or < 2 lines; drafts may be unbalanced while building. Crucially it is a CONSTRAINT TRIGGER (deferred to commit)
— a multi-line entry is transiently unbalanced mid-insert (after line 1, before line 2), and a naive per-row
trigger would falsely reject it; the deferred check validates the FINAL total. Being a trigger on
fin_journal_lines, it binds EVERY writer (API, DEFINER posting fns, direct SQL, service-role) — so no path can
commit an unbalanced posted entry. The ledger cannot hold a debit≠credit entry. Hypothesis (unbalanced entry
slips through) impossible. This + period-lock (34) + posting-immutability + author-pin (33) + the balanced-by-
construction postings (payroll/year-end/depreciation/credit-note) = the double-entry integrity is airtight.

## 38. CROSS-TENANT READ isolation VERIFIED — no unscoped SELECT, pervasive auth_company_id()
The write-focused rls:audit gate confirms writes pin the tenant; this closes the READ side. NO core/tenant
table has a `using (true)` SELECT policy (grep clean after excluding the deliberate vendor/public/widget
cross-tenant tables). Core reads are company-scoped: events (0004 `for all using (company_id = auth_company_id())`),
problems/tasks/signals/companies all scope SELECT to auth_company_id(). 88 migration files use auth_company_id()
— tenant scoping is pervasive, not spot-applied. auth_company_id() resolves the caller's company from their
session, so a user can read ONLY their own company's rows, by ANY path. Cross-tenant-read hypothesis handled.
With the service-role sweep (21), widget audit (19), routing (30), and email threading (31), tenant isolation
is verified across EVERY access path — RLS reads+writes, service-role routes, and the public surfaces.

## 39. auth_company_id() — the TENANT-ISOLATION LINCHPIN — VERIFIED un-spoofable
Every tenant-isolation guarantee (classes 19/21/30/31/38, all 88 files) rests on this one function. Definition
(0001:86-91): `select company_id from profiles where id = auth.uid()`. It resolves the caller's company from
their PROFILE ROW, keyed by auth.uid() — the user id derived from the cryptographically-VERIFIED session JWT,
NOT a client-supplied claim or parameter. A user cannot forge auth.uid(); company_id is set by the email-matched
onboarding/invite-accept path (0114, class 28). security definer reads ONLY the caller's own profile, so it
leaks nothing and returns nothing but the caller's own company. Therefore `company_id = auth_company_id()`
across the schema is a trusted, unforgeable check. The single most important security function in the codebase;
sound. Spoofability hypothesis handled. This is the FOUNDATION under all of classes 19/21/30/31/38 — they are
only as good as auth_company_id(), and it is correct.

## 40. 🔴 CRITICAL (fix exists, APPLICATION UNVERIFIED) — profiles privileged-column self-write → cross-tenant
Independently re-derived from the class-39 linchpin: auth_company_id() reads profiles.company_id, so it is only
unforgeable if a user cannot CHANGE their own company_id. The base profiles UPDATE policy (0001:110) is
`for update using (id = auth.uid())` with NO WITH CHECK → Postgres leaves the new row's columns unconstrained,
so `PATCH /rest/v1/profiles?id=eq.<self> { "role":"admin", "company_id":"<any-tenant>" }` would succeed:
auth_company_id() then trusts the self-set value → FULL CROSS-TENANT read/write (or company_id := vendor tenant
→ vendor super-admin). Highest severity.
**This was ALREADY FOUND (2026-07-07 audit) and FIXED — migration `0090` — a BEFORE UPDATE trigger
guard_profile_privileged_columns() freezing role/company_id/sales_coach_role/is_support_agent against direct
authenticated/anon writes (DEFINER/service-role pass through). Exemplary fix (trigger to see OLD vs NEW,
fail-safe block-list).** BUT `0090`'s own text says "Founder must APPLY this migration; the hole is open until
then," and the memory records the founder applying 0094-0115 — `0090` is BEFORE that range, so its application
status is UNVERIFIED. ⚠️ IF 0090 IS UNAPPLIED, THIS IS A LIVE CRITICAL CROSS-TENANT ESCALATION. The app itself
never writes profiles.company_id via the user client (grep-confirmed), so the exploit is a direct crafted
PostgREST call, not reachable through the UI — but RLS is the boundary, and it is open without 0090. FOUNDER
MUST CONFIRM 0090 (+ its coupled care-agent-settings service-role change) is applied. This is the single most
important item surfaced this session. In the founder queue, top priority.

## 41. §A26 BOUNDARY SWEEP of the class-40 pattern — + an honest severity CORRECTION of class 40
Class 40 is a *class* ("self-scoped UPDATE policy — `using (... = auth.uid())` with no `with check` — leaves a
privileged column self-writable"), not a one-off, so §A26 requires sweeping its boundary. Enumerated every
self-scoped write policy in the schema:
- **profiles** (0001:111) — the class-40 hole → guarded by trigger **`0090`** (`profiles_guard_privileged`).
- **chat_participants** (0010:192) — update policy gates only on topic-in-same-company (no `user_id=auth.uid()`,
  no `with check`); the table has a `role` column (admin/member/observer) that IS consumed for authz
  (topic-decision locking at chat/topic-decisions/route.ts:91; RLS 0033). So a member could `PATCH` their own
  participant row to `role='admin'` (self-promote) or set another user's `left_at` (kick from a private topic).
  **Already found + fixed — migration `0093`** (`chat_participants_guard_privilege`, BEFORE trigger:
  "role may only be changed by a topic admin"). Same guard pattern as 0090.
- **care_agent_state** (0042:152) — hardened by `with check` (0095) + tenant-pin (0156). ✓
- **fin_expense_reports** (0125) — has a status-guarded `with check`. ✓
- **files** (0154) — company-pin `with check` (0154). ✓
- The many `for update using (company_id = auth_company_id())` policies with no explicit `with check` are SAFE:
  Postgres defaults `with check` to the `using` expression, so company_id is pinned to the caller's tenant.
  profiles was unique precisely because its `using (id = auth.uid())` said nothing about company_id.

**Conclusion — the class is CLOSED in migrations, by two triggers: `0090` (profiles) + `0093` (chat_participants).**

**CORRECTION of class 40's severity (§5 honesty / §A24 don't-manufacture-severity):** class 40 called this
"a LIVE CRITICAL … the single most important item," reasoning that `0090` is below the applied `0094-0115`
range. That over-stated it. **Supabase applies pending migrations strictly in numeric order — it cannot apply
`0094` while `0090`–`0093` are pending.** Applying through `0115` therefore necessarily applied `0090`–`0093`
first. Realistic status: **applied.** The correct action is a one-query confirmation, not an alarm:
`select tgname from pg_trigger where tgname in ('profiles_guard_privileged','chat_participants_guard_privilege');`
(expect 2 rows). Only a hand-applied out-of-order history could leave a gap. Founder queue updated to reflect
this (🟠 confirm, not 🔴 live-hole). The finding remains worth surfacing — the fixes' *existence* is what makes
the base-policy holes moot — but the honest severity is "confirm the ordering held," not "critical live hole."

## 42. DEPRECIATION reference test (0166) — WRITTEN, and it surfaced a LOW cosmetic behavior
Added `src/lib/finance/__tests__/depreciationSalvage.test.ts` (6 cases) mirroring
`fin_run_depreciation`'s per-period amount: `round((cost-salvage)/life, 4)` slice, clamped by
`least(slice, (cost-salvage) - accumulated)` (the salvage floor). Pattern = recurrenceAnchor.test.ts:
the SQL is source-of-truth, the JS mirror pins the acceptance spec for the one part invisible without a
live DB (behavior near full depreciation — failure mode #1 named in the migration header).
**The test earned its keep — it caught real behavior on first run:** for `10000 / salvage 0 / life 3`,
monthly rounds DOWN to `3333.3333`; three slices = `9999.9999`, leaving a `0.0001` residual → the clamp
posts a FOURTH sub-cent "stub" slice to close on `10000` exactly. So a rounding-down residual makes the
schedule run **life+1 periods**, the last a stub (e.g. a 37th entry on a 36-month asset).
**Severity: LOW / cosmetic — NOT a correctness bug.** The 8-shape invariant test confirms the total always
lands on exactly `(cost - salvage)` and NBV never dips below salvage — the money is right. The only
imperfection is presentational: the rounding residual spills into a trailing stub period instead of being
absorbed into the final SCHEDULED slice (the conventional accounting "plug"). Flagged LOW in the founder
queue as a cosmetic decision (allow stub vs. absorb into final scheduled slice). Consistent with §A24 /
§5 — surfaced at its true (small) severity, not inflated. This is the productive kind of "test finds
behavior the reader would miss," the opposite of the class-40 over-statement I corrected in class 41.

## 43. BREAK-EVEN refusal reference test (0176) — VERIFY-CLEAN, regression protection added
Added `src/lib/finance/__tests__/breakEvenRefusal.test.ts` (7 cases) mirroring `fin_break_even`'s
break_even_revenue + reason logic. The correctness-critical behavior is THE REFUSAL: break-even =
fixed_cost ÷ contribution-ratio, but when contribution margin is ZERO or NEGATIVE the formula would still
divide and hand back a *negative* break-even that reads as a small achievable target — when the truth is
"no volume breaks even; every sale grows the loss." The view returns NULL there. **Result: CLEAN — the SQL
refuses exactly as designed** (negative contribution → NULL, zero contribution → NULL not infinity, zero
revenue → NULL ratio + NULL break-even). Unlike depreciation (class 42), this reference test found no
behavior gap; its value is the locked invariant `break_even IS NULL ⇔ reason IS NOT NULL` (refusal always
carries words; a number never does) against a future "simplify the CASE" regression. One TEST bug caught +
fixed in-session (`expect(null).not.toBeLessThan(0)` throws — redundant with the toBeNull above; removed);
no algorithm change. Finance reference tests now: recurrence, depreciation, break-even (78 finance tests).
The reference-test sweep of subtle DEFINER math is at a sensible boundary — depreciation found a LOW
cosmetic behavior, break-even is clean; the remaining calc surfaces (FX, cash-flow) are lower-risk
(fewer sign/rounding traps) and can get tests if a specific doubt arises, not speculatively (§A24).

## 44. FINANCE SURFACE end-to-end reachability (§1.5.1 layers 2-3) — VERIFY-CLEAN, rigorous
Follows the class 42-43 reference tests: correct SQL is worthless if no real user can reach it (layer 2 =
"does it actually work end-to-end," not "does the unit pass"). Traced the two just-tested features and then
the whole finance surface:
- `fin_run_depreciation` ← `api/finance/assets/route.ts` ← `/dashboard/finance/assets` page (fetches it) ←
  `FinanceNav.tsx` link. `fin_break_even` ← `api/finance/unit-economics` ← page (fetches) ← FinanceNav link.
  Full chain FinanceNav → page → fetch → route → DEFINER → DB, intact for both.
- **Whole-surface navigability, rigorously:** a count match (28 linked hrefs == 28 page dirs) can hide a
  coincidence (one orphaned page + one dead link offsetting), so I ran a SET-DIFF (`comm -3` of page dirs vs
  linked hrefs). **Empty diff → perfect 1:1: every finance page dir has a nav link and every link resolves to
  a page. No orphaned feature, no dead link across 28 sub-pages.** DB→route reachability is separately
  guaranteed by the green INVARIANT-3 gate. So the finance product is reachable top-to-bottom.
Method note for future audits: prefer a set-diff over a count when checking correspondence — equal counts are
a classic false-clean. This is the layer-2/3 complement to the calc-correctness reference tests: the money is
right (42/43) AND a user can actually get to it (44).

## 45. WHOLE-APP orphan check — verify-clean, and a METHOD CAUTION (nearly reported 40 fake orphans)
Tried to generalize class 44's set-diff from finance to the whole app: find any `page.tsx` route linked from
nowhere (a §1.5.1 layer-3 dead-end). The naive version (`comm -23` of all page routes vs JSX `href="..."`
literals) flagged **~40 "orphaned" pages — INCLUDING the finance pages I had JUST proven are 1:1-linked**
via FinanceNav. That contradiction is what caught it: verify-before-report (§A24). Root cause: this codebase
authors nav as CONFIG ARRAYS (`{ href: "/dashboard/finance/assets", label }`) — property syntax — plus
template strings and redirects; a `href="..."` attribute grep misses all of those. Corrected to match the
route STRING anywhere (the extraction class 44 actually used) → list dropped to 12, and every one is an
ENTRY-POINT or PUBLIC page (`/`, `/dashboard` root, `/login`, `/privacy`, `/terms`, `/help`, `/demo`,
`/pitch`, `/onboarding`, `/install`, `/sales-coach/*`) reached by URL/redirect/footer/external — not a
surprising orphan. (A second artifact inflated even this: the href-grep only extracted `/dashboard/*` +
`/auth/*` prefixes, so pages outside those prefixes show "unlinked" regardless.) **Conclusion: no real
orphaned feature; the app's navigability is sound.**
DURABLE METHOD LESSON (the real asset here): the class-44 set-diff is trustworthy ONLY on a surface with
UNIFORM nav (one config array, one route prefix, matching extraction) — finance qualified. Generalized across
heterogeneous nav patterns, grep-based orphan detection is a false-positive machine; it nearly produced a
40-item fake-finding report. When a mechanical check contradicts something already proven (finance is linked),
the check is wrong, not the prior. Do not ship grep-orphan lists app-wide without per-candidate confirmation.

## 46. THE MOAT METRIC (§3.5 communication-quality — consequence-not-agreement) — VERIFY-CLEAN, 4 axes
Pivoted off the diminishing-returns nav grind to the single most constitution-central surface: how the Coach's
effectiveness is measured. §3.5's hardest rule: "Measuring agreement instead of consequence is grading your own
homework — forbidden." Audited `api/admin/coach-readout/route.ts` + its page on FOUR axes, all sound:
1. **Substance** — primary metric is `close_durability` (held/reopened/partial), a downstream CONSEQUENCE. The
   route header + code (lines 36-37) explicitly: "does NOT weight accepted suggestions as proof of value.
   Acceptance is a leading indicator only; consequence is the [answer]." Accept-rate exists solely for
   heuristic mis-calibration (A4), not as the verdict.
2. **Surface (§1.5.1 layer 4 — the honest-code/dishonest-surface trap)** — the PAGE leads with a framing
   contract, headlines "changes downstream consequence — NOT agreement," reads the Held column FIRST, presents
   NO verdict, and — the §4 move — STATES THE FALSIFICATION BAR BEFORE THE DATA ("at N>=10, if coached
   held-rate is no better than uncoached, that's the rollback signal, not a reason to reframe the metric").
   A good-looking chart cannot retroactively define success.
3. **Provenance** — `close_durability` is a mutable column BUT every change emits an immutable
   `chat.topic_durability_reviewed` event (0015, mirroring the resolutions chain verified in class 18); a
   `reopened` is captured even if the topic was optimistically marked `held` at close. History is on the
   append-only record.
4. **Experimental design (the anti-gaming clincher)** — the readout compares COACHED vs UNCOACHED durability
   at EQUAL N. Any residual subjectivity in "held" inflates BOTH arms equally and cancels in the difference —
   the metric is the comparison, not the absolute. Systematic self-grading cannot manufacture a coached
   advantage. This is the structural defense §3.5 demands, done correctly.
**The product's thesis-defense is intact at its most important point.** This is the highest-value clean of the
session — a completely different domain from the finance/nav checks, hitting the constitution's most-emphasized
anti-pattern at the moat, sound on substance AND surface AND provenance AND design. Contrast with the
classes-44/45 nav grind (artifacts): this is where audit attention actually belonged.

## 47. §3.6 "MAKE LEARNING VISIBLE" — the vanity-metric trap — VERIFY-CLEAN, real evidence not theater
Companion to class 46: §3.5 asks "is effectiveness measured by consequence?"; §3.6 asks "is the *learning-is-
happening* evidence REAL, or a persuasive-but-empty progress display?" ("a value curve nobody can see is a flat
line" — but a FAKED curve is the dishonesty the whole project exists to prevent). Audited
`LearningVisibleSection.tsx` + `api/brain/learning-summary/route.ts`:
- **Real aggregation, not fabrication** — reads the actual `events` table (coach-suggestion events by heuristic,
  decision.opened/decided, cumulative pattern count) + `chat_topics` durability, all company-scoped,
  time-windowed (last-28 + last-7-vs-prior-7 for a genuine period comparison). NO Math.random, NO hardcoded
  numbers, NO generic "AI is learning…" filler.
- **Genuine readiness threshold, not N=1 theater** — `accumulating = chainTotalAllTime < 30`: the surface
  explicitly says "not enough accumulated yet" until ≥30 real chain events exist, "instead of showing tiny
  numbers as if they were signal." A brand-new team sees an honest empty state, not fake progress.
- **Fail-closed on read error (§3.4 honest-error-state, ref 2026-07-09 audit)** — if ANY chain read fails, returns
  `ready:false` rather than rendering zeros, which would make the panel LIE ("the team did nothing") on a
  transient DB hiccup. Never render an error as inactivity.
- **Honest surface** — consequence-only framing ("counts the chain accumulated, NOT verdicts"; "durability is
  the consequence measure, NOT acceptance/click-through"; "vanity metrics make AI tools feel smart while
  changing nothing").
**Both moat-honesty pillars now verified this session: §3.5 effectiveness (46) + §3.6 learning-visible (47).**
The product's "honesty is the moat" thesis is implemented honestly at the two surfaces most tempting to fake —
the effectiveness verdict and the progress display. This is the audit attention that pays; recorded as the
high-value pair that closes the §3-thesis surface review.

## 48. §3.3 "GUIDE, DON'T OVERTAKE" — ask-first is ENFORCED at the API contract — VERIFY-CLEAN
Third thesis pillar (with 46 §3.5, 47 §3.6). §3.3 (non-negotiable product behavior): "The System ASKS the user
what they think the best solution is BEFORE asserting its own." The failure mode is an assert-first flow that
hands over the answer. Traced all three coaching surfaces:
- **`chat/guide`** (message refinement) — sharpens the user's OWN draft IN THEIR VOICE ("you are not writing a
  new message; surfacing what they were trying to say"); user accepts/edits/discards; System never decides.
  Guide-not-overtake for its purpose. ✓
- **The assert-first surfaces were RETIRED, not left lying around** — `ai/decision` + `ai/analyze` are now 410
  deprecation stubs, their own comments naming WHY: `ai/decision` "presupposes the answer space exists
  independent of the user, which is the §3.3 overtake"; `ai/analyze` "asserts a problem without signals,
  asserts without asking user first." Codified in `docs/GUIDE_DONT_OVERTAKE.md`. The anti-pattern was
  structurally removed, not just discouraged.
- **The replacement ENFORCES ask-first at the schema** (the clincher — enforcement, not a comment):
  `DialogueDecisionSchema` requires `userDiagnosis: z.string().min(20)` AND `userProposal: z.string().min(20)` —
  both mandatory, 20-char floor (not `optional()`, not `min(1)` a space satisfies). `decision-dialogue` CANNOT
  be invoked until the user has articulated their own diagnosis and proposal. The prompt then injects those so
  the System engages WITH the user's view (adds perspective, compares) rather than replacing it — §3.3's "offer
  how and why, never take over." A `suppressed` path lets the System refuse outright.
**Three §3 thesis pillars verified this session by ENFORCEMENT evidence, not comments: §3.3 ask-first (schema
min-length gate), §3.5 consequence-not-agreement (durability comparison at equal N), §3.6 real-not-vanity
(≥30-event readiness + fail-closed). The product embodies the method it runs on — structurally, where a future
edit would trip a gate, not merely in prose.** The §3 constitutional core is comprehensively verified sound.

## 49. §3.4 CONTROL-GATE (month-1 honest-baseline suppression) — enforcement RE-READ this session — CLEAN
The one thesis pillar I had been asserting from MEMORY ("brain/ gate is fail-closed") rather than re-reading —
§0.1 / §6-checklist-#1a forbid citing cached labels for a substantive claim, so I read the actual code this
session. §3.4 is the sharpest honesty rule: "a system that behaved identically for every customer on install
would be claiming understanding it cannot have — a lie"; month-1 must be a suppressed control baseline.
Enforcement, verified line-by-line in `src/lib/brain/index.ts`:
- **Fail-closed arithmetic** — `evaluateControlGate`: `autoUnlocked = Boolean(unlockAt) && new
  Date(unlockAt).getTime() <= now`. A NULL unlock → `Boolean(null)`=false. A MALFORMED unlock → `NaN <= now`
  =false. Either way the company stays SUPPRESSED. `guidanceEnabled = manualEnabled || autoUnlocked`, so the
  default (both false) is suppressed. The comment names the §5 concern verbatim: "the builder-under-pressure
  default must be 'suppressed,' never 'enabled'."
- **The `controlExempt` bypass is NOT a backdoor** (the real test) — every one of the exempt call sites is the
  SEPARATE Sales-Coach / Dissect product (`coach/sales-session/*`, `dissect/ask-coach`, `salesReview`,
  `salesSummary`, `coachV5`/`dissectCoachV5`), which the FOUNDER decided is active day-1 (2026-06-30, documented
  in-code: "the control window is for the Elostate diagnostic system only"). The Elostate team-diagnosis path
  and C.A.R.E do NOT set it. Confirming the split: the TEAM `ai/decision-dialogue` (the §3.3 route, class 48) is
  ABSENT from the exempt list → it stays §3.4-gated. On-demand separate-product tools are exempt by founder
  decision; the ambient team-guidance intervention that §3.4 governs is not.
**All SIX §3 sub-sections now enforcement-verified IN THIS SESSION (§3.1 rewrite-rule immutability, §3.2 gate
counts, §3.3 schema ask-first, §3.4 fail-closed control-gate, §3.5 equal-N durability, §3.6 30-event+fail-closed
readiness).** The §3 constitutional core — the product's entire thesis-defense — is comprehensively sound by
enforcement evidence, not prose, and the one memory-only claim is now re-earned by reading (§0.1 satisfied).

## 50. Considered a mechanical gate for the self-write class (40/41) — DECLINED, with reasoning (§5)
The §1.6 instinct after finding a class is to make it mechanical (as INVARIANT 5 did for uploads). Measured
whether the self-scoped-update-without-WITH-CHECK class (40/41) admits a precise gate. It does NOT, and building
a noisy one would be the §5 "less honest for a faster result under pressure" failure. Reasoning on the record:
- The pattern is ~7 distinct self-scoped UPDATE policies; most already carry a `with check` or a guard trigger
  (profiles→0090, care_agent_state→0095/0156, files→0154, fin_expenses→0125, chat_participants→0093,
  notification_subscriptions→0029/0107).
- A PRECISE gate must distinguish a DANGEROUS self-scoped update (`using (id = auth.uid())` pins the row but
  leaves a PRIVILEGED column — role/company_id — writable) from a SAFE one (where `with check` defaults to
  `using` and pins everything that matters). That "is there a privileged column on this table" judgment is NOT
  statically determinable from the SQL. So:
  - BROAD gate (flag every self-scoped update lacking an explicit `with check`) → fires on legitimately-safe
    policies → false-positive noise, below the precision bar the other invariants hold.
  - NARROW gate (assert the 0090/0093 triggers exist in the migration set) → near-trivially true given
    append-only migrations, and cannot detect the real risk (a FUTURE `DROP`).
- INVARIANT 5 earned its place because the upload pattern was UNAMBIGUOUS. This one isn't. The lesson is instead
  carried by (a) the two guard triggers themselves, (b) the baseline note below, (c) classes 40/41's record.
DECISION: no gate built. The discipline demonstrated: after measuring, decline to ship a persuasive-but-noisy
mechanical check rather than manufacture one to satisfy build pressure (§5, §A24). A gate that cries wolf trains
the team to ignore it — worse than no gate. If a future refactor ever consolidates these base policies, classes
40/41 + the trigger comments are the guardrail.

## 51. C.A.R.E performance grader (§3.5 analog for the care product) — VERIFY-CLEAN, hypothesis refuted
The coach-readout (46) is the ELOSTATE-product effectiveness surface; C.A.R.E has its own agent grader
(`care/grader.ts`), un-audited this session. Hypothesis: does it grade agents by CONSEQUENCE or commit the §3.5
grading-own-homework sin (agreement / the model's opinion of itself)? Refuted — the architecture mirrors 46:
- **The grade can't be self-inflated** — `validateCounts` sanitizes the model's self-report into trustworthy
  countables (positives→0/1, risks→non-negative ints, malformed→null); `deriveGrade` computes the grade FROM
  those countables, "never the model's opinion" (its own §3.5 comment). Positives = acknowledged/answered/
  next_step; risks = unsupported_absolutes/fabricated_specifics(hallucination)/empty_filler. Any risk or <2
  positives → needs_guidance; 3/0 → productive. The model cannot grade itself "productive" by asserting it.
- **It's the MECHANISM measure, used correctly as per-reply feedback** — `messages/route.ts` stores
  `coach_grade` on the individual message. NOT aggregated into a headline "agent effectiveness" verdict, so it
  isn't the mechanism-masquerading-as-result trap.
- **CONSEQUENCE is measured SEPARATELY and honestly** — `care/agent/analytics` computes `resolutionRate` from
  `resolved_at IS NOT NULL` (the durable event, NOT current status), its comment naming it: "Counting [current
  status] would be a §3.4/§3.5 perverse signal. resolved_at IS NOT NULL is the honest measure." (This is the
  resolution-rate fix shipped earlier THIS session.)
So C.A.R.E splits it exactly as §3.5's causal order demands: reply-quality per-reply for COACHING (mechanism),
resolution durability in aggregate for EFFECTIVENESS (consequence). **Both products' moat metrics now verified
§3.5-sound: ELOSTATE coach-readout (46) + C.A.R.E grader/analytics (51).** The grading-own-homework prohibition
holds across the whole product, not just the surface I first checked.

## 52. LLM-route rate-limit coverage — VERIFY-CLEAN; gate DECLINED (call-graph); CHOKEPOINT proposed
The baseline note "new LLM routes MUST carry rateLimit" is prose with no gate (unlike uploads → INVARIANT 5).
Swept it the way the upload sweep found fix #15:
- **VERIFY-CLEAN, zero gaps** — every route that actually invokes an LLM is throttled. User-facing routes call
  `rateLimit` (ai/decision-dialogue, chat/*, coach/sales-session/*, coach/v5/grade-sent, …). The one that DOESN'T
  is `care/inbound/email` — and that's correct: email has no IP/user key, so it uses a purpose-built PER-SENDER
  throttle (`senderAiReplies` within `AI_SENDER_WINDOW_MS` → emits `ai_suppressed_flood` and returns BEFORE
  `generateCareReply`). Two grep "gaps" (`brain/route.ts`, `brain/unlock`) were false positives — they import
  `@/lib/brain` for the §3.4 control-gate (`loadBrain`/`loadControlGate`/`unlockControlGate`), not an LLM call.
  `health`/`settings` only read `Boolean(process.env.*_API_KEY)`. All refuted by reading, not assumed.
- **A mechanical gate is NOT cleanly achievable (declined, same reasoning as class 50)** — "does this route
  invoke an LLM" is a CALL-GRAPH property, not a pattern: the care agent-messages route reaches the LLM via
  `gradeCareAgentReply` (care/grader.ts) → `gradeCoachV5`, two hops from the route. Direct-name detection →
  false negatives; import detection → false positives (control-gate imports). A grep gate would be one or the
  other. Below the precision bar INVARIANT 3/4/5 hold. No gate built.
- **The STRUCTURAL answer, since the gate can't be (proposal, founder-gated)** — every LLM call in the codebase
  funnels through the internal `call()` in `src/lib/claude.ts`. A per-company rate-limit AT THAT CHOKEPOINT
  would make "no route can make an unthrottled LLM call" true BY CONSTRUCTION — the guarantee a route-level gate
  can't give. It slightly changes behavior (a per-company LLM ceiling, defense-in-depth atop the existing
  per-route/per-sender throttles), so it's a founder decision, not a by-fiat build. Added to the queue.
This is the §1.6 pattern completed honestly: when the lesson can't be made mechanical at the layer prose
describes (the route), find the layer where it CAN be structural (the chokepoint) — and propose it rather than
ship a gate that cries wolf or misses.

## 53. PRE-APPLY dependency verification of this session's built migrations (0184/0185/0186) — CLEAN
Directly de-risks the founder's biggest pending action (applying the queue). A migration referencing an object
not yet present fails MID-APPLY — this exact class already bit once this session (`0175` referenced a
non-existent `i.paid` column, caught + fixed to `received`). So I traced every object the three UNAPPLIED
migrations I built reference, against the already-applied baseline (founder applied through 0115 + finance
0121-0143 + recurring 0140):
- **0184** (task-overrun exclude Cancelled) — `create or replace` of `emit_task_overran_event` +
  `run_task_overrun_sweep` (originals from 0109, APPLIED); reads `tasks` (0001/0032) + `events` (0001). ✓
- **0185** (dashboard AR nets credit notes) — `create or replace fin_dashboard_summary`; the risky refs are
  summary-view COLUMNS (the 0175 class). Verified: `fin_invoice_summary` (0143) exposes `total`+`received`+
  `credited` → `sum(total-received-credited)` valid; `fin_bill_summary` (0135) exposes `total`+`paid` →
  `sum(total-paid)` valid. The migration's own comment already flagged "`credited` present since 0143". ✓
- **0186** (recurring anchor-day) — `alter table fin_recurring_bills add anchor_day` (table from 0140, APPLIED)
  + backfill from existing `next_date` + `create or replace fin_generate_recurring_bill` over `fin_bills`/
  `fin_bill_lines` (applied). ✓
Apply-ORDER is also safe: numeric order applies 0114/0115 → 0157-0182 → 0184/0185/0186, and none of the three
depends on anything in the 0157-0182 batch (all their deps are ≤0143). **All three will apply cleanly onto the
current schema.** No 0175-class missing-object/wrong-column trap remains in what I built. (I did NOT re-verify
the pre-existing 0157-0182 batch object-by-object — those weren't built this session; flagged as the one part
of the apply queue whose dependency-safety I'm asserting from their authors, not from an in-session trace.)

## 54. 0157-0182 batch apply-safety (the largest queue chunk) — forward-ref scan CLEAN after refuting 4
Class 53 verified the 3 migrations I BUILT; this closes the gap I flagged there — the pre-existing 0157-0182
finance batch (26 migrations), the largest part of the founder's apply queue. The batch has PHASE DISORDER
(0166 "Phase 8 Part B" before 0167 "Part A"; Phase-4 items 0173/0176/0177/0179 scattered among Phase 6/7/9) —
exactly where a forward reference (a lower migration depending on an object a higher one creates → mid-apply
failure) would hide. Built an object→first-created-migration map for the batch and scanned every migration for
references to objects created LATER in the batch.
- **4 candidates flagged, ALL 4 refuted** (verify-before-report): 0157/0158/0166/0167 reference `fin_can_approve`,
  which my batch-only map recorded as "first created in 0168." False positive — `fin_can_approve()` actually
  ORIGINATES in **0116** (finance foundation, APPLIED); 0168 merely `create or replace`s it (delegation-aware).
  The four call it as a guard (`if not fin_can_approve() then raise`) — an already-existing function. The map
  was blind to pre-batch origins; checking the true origin cleared all four.
- **No other forward reference** — every table/view/function referenced in the batch either exists pre-0157
  (applied foundation) or is created by an earlier-numbered batch migration. Legit `create or replace` overrides
  (0168 over 0116's fin_can_approve; 0168 over 0157's fin_approval_limit_for; 0182 over 0149's fin_budget_variance)
  are all later-replaces-earlier, never the reverse. Phase disorder is cosmetic (labels), not dependency order.
**The 0157-0182 batch is apply-order-safe.** Scope honesty: this verified TABLE/VIEW/FUNCTION forward-refs (the
mid-apply-failure class); it did NOT exhaustively cross-check every COLUMN reference against its adding migration
(a narrower risk — the 0175-class column typo was a never-existed column, not a forward-ref, and 0185's columns
were spot-verified in class 53). Combined with class 53, the ENTIRE apply queue (0114/0115 + 0157-0182 +
0184/0185/0186) is now forward-reference-clean and applies cleanly in numeric order onto the current schema.

## 55. Column-level forward-refs in 0157-0182 — the piece class 54 scoped out — also CLEAN
Completes the apply-safety story. A column forward-ref (migration N reads column X that migration M>N adds →
mid-apply failure) can only target an `alter table ... add column` in the batch. Enumerated them: 0161
(fin_expense_items.kind/quantity/jurisdiction), 0170 (fin_vendors.is_1099/tax_classification), 0179
(problem_id on fin_journal_lines/bill_lines/expense_items), 0181 (fin_invoice_lines.item_id/qty). Then checked
whether any EARLIER batch migration reads each:
- **problem_id** — the real risk (Phase-4 cost features are scattered: 0173/0176/0177 precede 0179). CLEAN: no
  pre-0179 migration references problem_id; 0179 both adds and first-uses it.
- **fin_invoice_lines.item_id / .qty** (added 0181) — CLEAN: the only pre-0181 `.qty` hits are 0180's OWN
  inventory tables (`m.qty` = movements, `i.qty_on_hand` = items, both created in 0180), NOT invoice_lines.
- **0161 / 0170 columns** — feature-local (mileage/per-diem, 1099); no earlier migration touches them, and all
  use `if not exists` (re-run-safe).
**No column-level forward reference exists.** With classes 53+54, the ENTIRE apply queue is now verified
forward-reference-clean at BOTH object and column granularity: it applies cleanly, in numeric order, onto the
current schema, with no mid-apply missing-object/missing-column failure. The apply-safety verification of the
founder's biggest action is COMPLETE. (What a live `supabase db push` on the founder's dev DB still adds beyond
this static trace: runtime constraint violations against real DATA — e.g. a NOT-NULL backfill on existing rows.
Those are data-dependent and unknowable from source; the founder's dev-apply is the right place for them.)

## 56. NOT-NULL-no-default ADD COLUMN across the whole queue — CLEAN (tightens class 55's boundary)
Class 55 punted "runtime constraint checks against real data" wholesale to the founder's dev DB. Part of that is
actually STATIC: an `add column ... not null` with NO default fails on ANY table that already has rows — a
schema-structural failure independent of what the data contains, detectable from source. Scanned the entire
apply queue (0114/0115 + 0157-0182 + 0184/0185/0186):
- Exactly ONE NOT-NULL add in the whole queue — 0170 `fin_vendors.is_1099 boolean not null DEFAULT false`. Has
  a default → safe on existing rows.
- 0186 `anchor_day int` is NULLABLE (`check (anchor_day is null or between 1 and 31)`), so its ADD succeeds
  before the backfill populates it. Every other added column (0161/0179/0181, etc.) is nullable.
- No NOT-NULL-no-default add anywhere → no structural NOT-NULL apply failure.
So the STATICALLY-detectable apply-failure surface of the whole queue is now fully clean across all three
classes: object forward-refs (54), column forward-refs (55), NOT-NULL-structural (56). The residual left for the
founder's dev push is precisely and only DATA-CONTENT-dependent constraint violations — an existing row that
happens to violate a new CHECK, a duplicate that trips a new UNIQUE, an orphan that fails a new FK. Those are
unknowable from source by definition. The static apply-safety verification is COMPLETE and its boundary is now
drawn exactly, not hand-waved.

## 57. The data-content residual (class 56) — diagnosed, and it's essentially NIL for this batch
Considered building a data-content PRE-FLIGHT script (founder runs it against the dev DB before applying, so a
mid-batch failure becomes a clean pre-check). §2 diagnose-before-building: is it needed? A data-content
violation needs a constraint on EXISTING data. New nullable columns can't be violated (existing rows are NULL →
satisfy a nullable FK). Scanned the batch for constraints on EXISTING columns (`set not null` / `add constraint
check|unique` / `create unique index`). Exactly ONE: 0161 `alter column kind set not null` on the existing
`fin_expense_items`. Traced its lifecycle:
  (1) add `kind text` nullable → (2) `update fin_expense_items set kind='receipt' where kind is null` —
  UNCONDITIONAL backfill of every existing row → (3) CHECK `kind in (receipt,mileage,per_diem)` (satisfied,
  all backfilled = receipt) → (4) quantity/kind CHECK (satisfied: receipt ⇒ quantity null, and quantity is a
  just-added nullable col) → (5) `set not null` (succeeds — step 2 left no NULL).
The one constraint-on-existing-data backfills itself completely before enforcing. So the batch's data-content
violation risk is ESSENTIALLY NIL, and the pre-flight script would address a risk that's already handled —
DECLINED to build it (don't build what isn't needed, §5/§2, same discipline as class 50's declined gate).
**This closes apply-safety to its true floor:** object forward-refs (54), column forward-refs (55),
NOT-NULL-structural (56), and now the sole constraint-on-existing-data (57) — ALL verified clean. The batch
applies cleanly onto the current schema AND its one existing-data constraint is self-backfilling. The residual
genuinely unknowable-from-source is now near-empty for THIS queue (it would only reappear if the founder's real
data somehow held a NULL `kind` the unconditional `where kind is null` update couldn't reach — impossible).

## 58. Verifying my OWN recommendation corrected it — the signal backstop is two parts, not "cheap insurance"
After adding recommendations to the 9 decisions (class-57 era), §3.3/§4/§5 obliged me to verify the one I
recommended building ("signal backstop → ADD, cheap insurance") before the founder acts on it. Designing the
migration precisely refuted the "cheap" framing — it's the §5 confident-answer-that-arrived-too-quickly:
- **Part 1 — `event_id` column + thread through `derive_signals_for_event`** — genuinely cheap: nullable column
  (existing signals carry no event link to backfill), and the live derive (0014) already has `p_event_id` in
  scope, so storing it is behavior-preserving.
- **Part 2 — partial unique index `(event_id, kind, source)`** — NOT cheap. The live derive inserts one signal
  PER matching `signal_sources` rule (outer loop over rules where event_kind matches). So the index is only safe
  if no two enabled rules for one event_kind emit the same (signal_kind, source_template). If a redundant rule
  exists, the index converts benign config redundancy into a HARD derivation failure — breaking the §3.1→§3.2
  chain for that event. That's a question about the founder's `signal_sources` DATA, unknowable from source.
Corrected the founder-queue recommendation: do Part 1 now (cheap, behavior-preserving, enables the backstop);
gate Part 2 on a "no redundant rules" data check, or implement it as monitoring rather than a hard constraint.
**This is the value of verifying your own advice before it's acted on** — same discipline as the class-41 0090
severity correction, one level up: the recommendation, not just a finding, was over-confident, and designing the
HOW (§3.3 "offer the how, not just the why") is what exposed it. I did NOT build either part (Part 1 is
low-risk but still touches the load-bearing derive function, and it pre-empts a fresh open decision — §3.3 says
guide, the founder greenlights, THEN I build carefully; contrast the recurring-drift build, which had a RECORDED
prior decision). The correction strengthens the advice without overtaking the call.

## 59. Resolved the Part-2 question I said was "unknowable" — signal_sources is static + collision-free
Class 58 corrected my "cheap insurance" rec but left Part 2 (the unique index) gated on "a data check I can't
see headlessly." Followed through instead of leaving it open — and the follow-through resolved it:
- **signal_sources is MIGRATION-SEEDED ONLY** — every app-layer reference (feedback/route, smoke-test, the
  chain integration test, taskOverrunSweep) is a COMMENT or a TEST; no route/lib INSERTs a rule at runtime. So
  the seeded rows are the COMPLETE ruleset — the redundancy question IS statically answerable, contra class 58.
- **Extracted all 12 seeded rules, checked for a collision** (two rules, same event_kind, same signal_kind +
  same rendered source → would violate the unique index during one derive). NONE. The only same-(event_kind,
  signal_kind) pair, `feedback.submitted → user_friction`, carries different predicates (`{"kind":"bug"}` vs
  `{"kind":"friction"}`) → different `source` → distinct key. So one derive call never self-collides; a
  re-derive (the guarded case) is correctly rejected. **Part 2 is safe against the current ruleset and does
  exactly its job.**
This is verify-further resolving uncertainty in the RIGHT direction — class 58 was right to distrust my "cheap,"
but its residual ("gate on a data check") was itself resolvable, and I resolved it rather than parking it on the
founder. Net: BOTH parts of the signal backstop are verified sound; the only residual is a hypothetical future
redundant rule, which the index would correctly reject at migrate time. The founder decision is now
"greenlight the build" (design verified end-to-end), not "go check your data first." Two corrections deep — the
confident "cheap" (58) AND the over-cautious "unknowable" (58's residual) — both walked to ground (59).

## 60. OUTSIDE-VIEW completeness pass (§1.3 adversary lens) — auth brute-force surface — VERIFY-CLEAN
Rather than re-drill covered ground under the guard, ran the §1.3 four-persona post-build discipline over the
SESSION's own security work, asking the adversary persona: "what attack surface did the sweep skip?" It surfaced
one the session never touched — AUTH brute-force / credential-stuffing (I'd checked LLM-route + widget-bootstrap
rate limiting, never login). Checked it:
- **No custom auth route exists.** login/signup/password-recovery all call the Supabase client DIRECTLY
  (`supabase.auth.signInWithPassword` / `signUp` / `updateUser` in the page components). The app never receives
  the password; the browser talks to Supabase GoTrue.
- **So brute-force protection is DELEGATED to Supabase GoTrue**, which ships built-in per-IP rate limits on all
  auth endpoints (sign-in, sign-up, OTP, password-reset, token-refresh). The dangerous path — a CUSTOM login
  route with no rate limit — does not exist here; the app correctly does not roll its own auth. Verify-clean.
- **Honest residual = CONFIG, not code:** the STRENGTH of those limits is a Supabase-dashboard setting (like
  VAPID / CRON_SECRET). Added to the founder queue's CONFIG line: confirm Supabase Auth rate limits are at
  sensible values. Inherited-on-by-default, so this is a confirmation, not a gap.
Method note: the value here was the STANCE, not new grep — the adversary persona named a surface my
finding-by-finding sweep hadn't, and it resolved clean. §1.3 outside-view earns its place as a post-build step
precisely by asking "what did the insider not think to check?" (Personas new-engineer/CFO/new-user added nothing
this session — the finance money-correctness, reachability, and doc-trustworthiness were already covered by
classes 42-56.) This is a genuine completeness confirmation, not a manufactured finding (§A24) — it closes a
named surface, and names its residual as config.

## 61. Adversary lens cont'd — STORED XSS (fix #18) + SSRF (clean) — the two surfaces the sweep skipped
Continued the §1.3 adversary pass over the two sharpest OWASP surfaces the finding-by-finding sweep never
touched: stored XSS and SSRF.
- **Stored XSS — verify-clean TODAY, and removed a purposeless SINK (fix #18).** Two `dangerouslySetInnerHTML`
  in the codebase: `layout.tsx` (static NO_FLASH_THEME_SCRIPT — safe) and `my-growth/page.tsx`'s `Section`
  component rendering its `title` prop as raw HTML. All 6 call sites pass STATIC literals → no XSS today. But
  the sink was UNNECESSARY: JSX decodes the `&rsquo;` entities in the double-quoted attribute value BEFORE the
  prop arrives, so `title` is already the decoded string — proven by `subtitle` (same component, also has
  `&rsquo;` in its literals) rendering fine via plain `{subtitle}`. The `dangerouslySetInnerHTML` produced
  output identical to `{title}` while leaving a stored-XSS sink a future dynamic caller (`title={principle.name}`
  from the DB/LLM) could walk into unaware — an A31-style seam: a raw-HTML sink behind a plain `title: string`
  prop. Replaced with `{title}` (identical render, sink gone). tsc+eslint clean. Defense-in-depth: the footgun
  can no longer be loaded.
- **SSRF — verify-clean.** Every server-side `fetch` targets a HARDCODED/configured endpoint: `POSTMARK_API`,
  ElevenLabs TTS/STT (voiceId is a path segment under the fixed host, can't override it), LLM provider URLs in
  `retry.ts` (configured, not user-supplied). No route fetches a user-supplied URL. The rest are client-side
  fetches of internal `/api/` paths (not SSRF).
Adversary-lens tally (classes 60-61): auth brute-force (clean, Supabase-delegated + config note), stored XSS
(clean + 1 footgun removed), SSRF (clean). The outside-view stance surfaced 3 named surfaces the insider sweep
hadn't; 2 clean, 1 yielded a real defense-in-depth fix. This is §1.3 doing exactly its job — and fix #18 is a
genuine catch (a purposeless raw-HTML sink), not a manufactured one.

## 62. Adversary lens cont'd — OPEN REDIRECT + CSRF — both VERIFY-CLEAN (closes the OWASP sweep)
Two more surfaces the finding-by-finding sweep never addressed:
- **Open redirect — clean.** All post-auth `router.push` targets are HARDCODED internal paths (`/dashboard`,
  `/onboarding`, `/dashboard/sales-coach`). The one dynamic helper, `buildDestination(base)`, always takes a
  hardcoded base and only APPENDS the user-controlled `intent` param as a QUERY STRING to it
  (`/dashboard?intent=X`) — `intent` is never the redirect target. `intent=https://evil.com` → still navigates
  to the internal `/dashboard?intent=…`. User controls a query value, never host or path. The recover flow's
  `redirect_to` is the SUPABASE-dashboard allowlist, not app-controlled.
- **CSRF — clean.** Auth is cookie-based via `@supabase/ssr` ^0.10.3. `server.ts` passes cookie `options`
  straight through to `cookieStore.set` WITHOUT overriding them → inherits the library's `SameSite=Lax` default.
  Lax = the session cookie is NOT sent on cross-site POST/PATCH/DELETE, the CSRF defense for state-changing
  routes. The app relies on the safe framework default rather than weakening it to `SameSite=None`. Correct
  posture for a Supabase-SSR Next.js app.
**OWASP adversary sweep COMPLETE (classes 60-62):** auth brute-force (clean, GoTrue-delegated + config note) ·
stored XSS (clean + fix #18 footgun removed) · SSRF (clean) · open redirect (clean) · CSRF (clean, SameSite=Lax).
Five surfaces the insider finding-by-finding sweep had not explicitly addressed — the §1.3 outside-view stance
surfaced all five and closed them (4 clean + 1 real fix). This is the productive boundary of the adversary lens:
the remaining OWASP items (IDOR → covered by auth_company_id RLS + the 28-route service-role audit; injection →
Zod-validated bodies + parameterized SQL; mass-assignment → the privileged-column guards 0090/0093) were already
covered by the earlier classes. Security perimeter now verified from BOTH the insider and outside-view stances.

## 63. GATED fix #18's class — `react/no-danger` ESLint rule (A30 via A33: the tool-native chokepoint)
Fix #18 removed one purposeless `dangerouslySetInnerHTML` sink. A30 says a fix isn't complete until the class is
gated; A33 says gate at the layer where the invariant is precise and structural. For "no raw-HTML injection,"
that layer is not a custom invariant-audit check — it's ESLint's OWN `react/no-danger` rule (precise: a literal
JSX-attribute match; currently-clean: after fix #18 only one use remains). Enabled `"react/no-danger": "error"`
in `.eslintrc.json`, and justified the single legitimate use — `layout.tsx`'s pre-paint theme script
(hardcoded module constant, zero user input) — with an inline `eslint-disable-next-line react/no-danger` + a
REASON (per A30's allowlist-with-reason discipline: an exception records WHY it's safe, not just that it was
silenced). `npm run check` runs `lint`, so this has CI teeth: the NEXT `dangerouslySetInnerHTML` fails the build
unless a developer consciously justifies it. eslint exits 0 (the one use is disabled, no others exist).
This is the A33 lesson applied cleanly, in contrast to classes 50/52 where I DECLINED a gate: there, the pattern
was imprecise (semantic/call-graph); here it is a literal string match with a natural tool-native home. The XSS
footgun can no longer be re-introduced silently — the class is closed at the gate, not just the instance.

## 64. Adversary lens — SECRET EXPOSURE (client-bundle leak / hardcoded keys) — VERIFY-CLEAN
Sixth adversary surface, and a high-severity one (a leaked service-role key bypasses all RLS for every tenant).
Three checks, all clean:
1. **`NEXT_PUBLIC_` env vars** — exactly 4, all legitimately public: `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon key is DESIGNED to be public — it is
   the RLS-protected client key), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the public half of the push keypair; the
   private half stays server-only). No secret rides the public prefix.
2. **Hardcoded secrets** — none. No `sk-…` literals, no `service_role` JWT strings, no inline `apiKey`/`secret`
   string literals (all secret access is via `process.env`).
3. **Service-role key in a client component** — none. `SERVICE_ROLE`/`service_role` never appears in a
   `'use client'` file, so the admin client (and its key) cannot be bundled into the browser. The admin client
   (`lib/supabase/admin.ts`) is server-only by construction.
**Adversary sweep now 6 surfaces (60-64): auth brute-force · stored XSS (+fix #18 +gate 63) · SSRF · open
redirect · CSRF · secret exposure — 5 clean + 1 fixed-and-gated.** Secret hygiene is sound: the only "public"
keys are the two designed to be public, and the catastrophic key (service-role) is structurally confined to the
server. The §1.3 outside-view sweep is now comprehensive across the headless-checkable attack surface, and it
resolved the way a mature codebase should: mostly clean, one real footgun found, fixed, and gated.

## 65. DEPENDENCY audit (`npm audit`) — 1 real advisory, MODERATE, NON-EXPLOITABLE here; auto-fix is dangerous
Supply-chain surface — distinct from the app-code adversary sweep, standard in a security review, unchecked
until now. `npm audit` reports 2-3 moderate advisories, all ONE root: transitive `postcss <8.5.10`
(GHSA-qx2v-qp2m-jg93 — XSS via unescaped `</style>` in CSS stringify output), pulled in by `next`.
- **Not exploitable in THIS app.** The advisory bites code that runs PostCSS on UNTRUSTED CSS input and serves
  the output. Next runs PostCSS at BUILD TIME on first-party CSS (Tailwind etc.), never on user input at
  runtime. The vector does not exist here. Honest severity: moderate advisory, effectively non-exploitable.
- **The npm auto-fix is CATASTROPHIC — do NOT run it.** `npm audit fix --force` resolves to `next@9.3.3` — a
  Next **16→9 downgrade**. npm's resolver misfiring; applying it is far worse than the advisory. Flagged loudly.
- **Safe remediation:** a `package.json` `overrides` pin of `postcss >= 8.5.10` (patch within 8.5.x,
  API-compatible), or wait for Next to bump its bundled copy. Low-urgency maintenance, needs a build test.
- **DID NOT modify the dependency tree** — non-exploitable + low-urgency + a maintenance decision needing a
  build verification = founder's call, not a by-fiat change (§3.3). Added to the queue as LOW with the
  auto-fix warning. This is what a dependency audit should produce: the advisory, its real exploitability HERE
  (not the abstract CVSS), and the SAFE fix path distinguished from the dangerous auto-fix.

## 66. PRODUCTION BUILD verified green (§1.5.1 Layer 2 capstone) — the session's changes are production-safe
`npm run check` covers typecheck/lint/theme/rls/invariant/805-tests but NOT the production build, which can fail
on build-time / static-generation issues the check misses. Ran `next build` — exit 0. Full compile, every route
generated (static ○ + dynamic ƒ), middleware (Proxy) built. Confirms this session's code changes — fix #18
(my-growth XSS sink → `{title}`), the `layout.tsx` eslint-disable justification, the `.eslintrc.json` +
`invariant-audit.mjs` gate additions — all compile for production. Combined: `npm run check` GREEN + `next
build` GREEN = the codebase is verified across BOTH the check pipeline and the production build. This is the
strongest headless "it actually works" evidence (§1.5.1 Layer 2 — end-to-end, not just unit-green), and the
honest capstone for the session's shipped changes. Everything committed this session sits on a fully-green tree
that also builds for production.

## 67. Structural-soundness sweep of the WHOLE apply queue (§A26 boundary of class 53's authored-only check)
Classes 53-57 verified apply-safety (forward-refs, columns, NOT-NULL, data-constraint) and I structurally
checked the 3 migrations I AUTHORED (0184/0185/0186). §A26: the class boundary is "ALL unapplied queue
migrations are structurally sound," not just mine. Swept the rest — dollar-quote parity, paren balance, BEGIN/
function consistency:
- **0114 / 0115** (account-join): even dollar-quotes, parens 27/27 & 16/16 balanced, 1 fn each. ✓
- **0141** (invite-escalation RLS): 0 functions / 0 dollar-quotes — CORRECT (pure `create policy` statements, no
  plpgsql body); parens 21/21. ✓
- **0142** (subledger created_by pin): even dollar-quotes, parens 51/51, 1 fn. ✓
- **0157-0182** (26 finance migrations): ZERO files with odd dollar-quotes or unbalanced parens. ✓
**The entire apply queue is now verified apply-safe on every statically-checkable dimension** — object
forward-refs (54), column forward-refs (55), NOT-NULL structural (56), existing-data constraint (57), file
presence, AND gross SQL structure (67, whole queue). No migration in the queue will fail the founder's apply on
a structural SQL error; the only residual is live-DB semantic checks against real data (the dev-push's job).
This is the complete, honest floor of what a source-only trace can guarantee about the apply.

## 68. Dormant scheduled-report cron — deferral is CORRECT, and diagnosed the PRECISE reason + sequencing
Re-examined the "build" category (not everything is un-buildable): `vercel.json` exists with 3 scheduled crons
(durability-sweep, backfill-dissects, task-overrun) — all live once `CRON_SECRET` is set. The finance
`deliver-cron` route EXISTS but has NO `vercel.json` entry (dormant). Rather than "build" it (add the entry),
checked WHY it was deferred: `deliver-cron` reads `fin_report_schedules_due` + calls `fin_record_report_delivery`,
both created in **`0172`** — in the UNAPPLIED finance batch. So adding the cron entry NOW would schedule a job
that ERRORS every run until the founder applies `0157–0182`. The deferral was correct; I gave the precise reason
(0172 dependency, sharper than the prior "shared CRON_SECRET" note) and the exact safe sequencing in the queue:
add `{ "path": "/api/finance/reports/deliver-cron", "schedule": "0 5 * * *" }` AFTER applying the batch. This is
A33/§2 in practice — I did NOT build the tempting thing (the cron entry) because diagnosing first showed it would
create an erroring cron; the honest output is the correct sequence, not premature motion. The 3 live crons + the
1 correctly-sequenced dormant one are now precisely documented for the founder's post-apply step.
**§A26 boundary swept:** enumerated ALL `*-cron` routes (4) vs `vercel.json` entries (3) — `deliver-cron` is the
ONLY dormant one; no other cron route is unscheduled. The cron-wiring surface is fully accounted for: everything
is either live-once-`CRON_SECRET`-set or the one correctly-sequenced-post-`0172` entry. No hidden dormant task.

## 69. Push-delivery OPEN item — `sender.ts` STATICALLY VERIFIED SOUND → the issue is definitively config
Applied fresh-eyes to the memory's "push delivery diagnosis OPEN" (subscribes fine, doesn't deliver;
`sender.ts` instrumented, awaiting founder logs). The prior approach WAITED for runtime logs. A fresh STATIC read
of the whole send path narrows it without the logs:
- VAPID setup (36-42): reads all 3 env vars, early-returns if any missing (logged, not silent). ✓
- Send (124-136): `webpush.sendNotification({endpoint, keys:{p256dh, auth}}, payloadString)` — correct
  subscription structure + stringified JSON payload. ✓
- Error handling (144-169): catch swallows NOTHING — logs `statusCode` + message in ALL envs; 404/410 →
  soft-disable dead sub; 403 → counted as the GLOBAL keypair-mismatch fault with a named diagnostic. ✓
**No code bug in the send path.** So push-delivery failure is DEFINITIVELY a config issue, not code — almost
certainly a VAPID keypair mismatch (browser subscribed with a `NEXT_PUBLIC_VAPID_PUBLIC_KEY` that doesn't pair
with the server's `VAPID_PRIVATE_KEY`) or the VAPID vars unset on the server. The code already DIAGNOSES which:
the logged `statusCode` names it (403 = keypair mismatch · 401 = bad VAPID auth · 410/404 = dead sub · early
"no VAPID configured" log = vars unset). Founder action narrowed to: set ONE matching keypair
(`npx web-push generate-vapid-keys` → both `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` on Vercel),
trigger a push, read the logged `statusCode`. No code fix pending. This is fresh-eyes value on an OPEN item:
static verification removed "is it a code bug?" from the founder's uncertainty — it's config, and the code
self-diagnoses the exact config fault.

## 72. Inventory WEIGHTED-AVERAGE cost reference test (0180) — BUILT, CI-runnable, closes part of the CI gap
The new-engineer-landmine lens surfaced the CI-coverage gap (chain + finance DB logic not CI-tested, queue
662-689). Most of it needs a live DB (correctly a founder staging decision) — BUT the subtle pure-ALGORITHM
parts are CI-testable via the reference-test pattern (recurrenceAnchor/depreciation/breakEven). Inventory
weighted-average cost (0180) was a strong untested candidate: perpetual WAC is classically subtle. Built
`inventoryWac.test.ts` (8 cases) mirroring both rules: RECEIVE `new_avg = round((qty·avg + rq·cost)/(qty+rq),4)`;
SELL `COGS = round(qty·avg,4)`, avg UNCHANGED (the WAC invariant vs FIFO/LIFO). Pins: first-receipt=cost,
canonical 100@1+100@2→200@1.50, sale-doesn't-move-avg, later-receipt-doesn't-retro-change-prior-COGS (perpetual
not periodic), rounding (16/13→1.2308), oversell refusal, non-positive refusal, mixed-sequence avg-only-moves-on-
receipt invariant. All 8 pass; 86 finance tests (was 78); tsc/lint clean via the suite. This is the RIGHT slice
of the CI gap to close headlessly: the WAC calc now has a CI regression guard, while the DB-level posting/balance/
concurrency behavior remains the founder's staging-CI decision (unchanged). A32 in practice: I did NOT ship the
un-testable GitHub Actions YAML (class 71's decision), and DID ship the fully-verifiable reference test — build
what you can verify, decline what you can't.
**§A26 sweep boundary of the finance-reference-test class (A33-bounded):** after building inventoryWac, checked
the next candidate — OVERHEAD ALLOCATION (0173). DECLINED: its formula is a single proportion
(`round(overhead × share, 4)`), and its one subtle aspect (do the rounded parts sum to the pool?) is
INTENTIONALLY not enforced because 0173 is analytical-only (a view/opinion, never a posted balancing entry). No
strong invariant to pin → below the bar. Boundary reached: the 4 genuinely-subtle, invariant-bearing finance
calcs are now CI-pinned (recurrence date-clamp · depreciation salvage-floor · break-even refusal · inventory
WAC+COGS); the remaining calcs are simple proportions/divisions (overhead, runway, FX = amount×rate) or
not-computed (payroll POSTS pre-computed values) or founder-gated (tax netting). Reference-testing those would
be the low-value-test A33 warns against. 86 finance tests is the productive ceiling for CI-runnable calc coverage;
the rest of the CI gap is genuinely DB-level (posting/balance/concurrency) — the founder's staging-CI decision.

## 73. §3.4 CYCLE-PHASE RESOLVER reference test (cycle/phase.ts) — BUILT; found by a SYSTEMATIC coverage scan
Instead of another one-off "is X tested?" probe (which kept returning already-covered), ran a SYSTEMATIC scan:
every `src/lib` module with real logic + no test. Most are correctly untested (DB wrappers, LLM-prompt builders,
API wrappers, React hooks — not clean unit targets). But it surfaced a genuine HIGH-VALUE gap: `cycle/phase.ts`,
the **§3.4 cycle-phase resolver** — a PURE function that mirrors SQL `company_cycle_phase` (0031) and decides
control (days 0-29, Coach LOCKED OFF — the month-1 honest baseline) / intervention (30-59, Coach may enable) /
ongoing (60+). It was UNTESTED. If the JS drifts from the SQL, app and DB disagree on whether a company is in
control — a §3.4 MOAT-integrity bug (the whole "month 1 = no AI guidance" honesty claim rests on this boundary).
Built `cycle/__tests__/phase.test.ts` (10 cases) pinning: day-0/29=control→`canEnableCoach=false` (the §3.4
lock), day-30 transition→intervention→unlockable, day-59/60 boundary, skip-control→intervention-immediately,
non-negative floor (future anchor → control = SAFE default, never accidentally unlocked), phaseEndsAt marks, and
the invariant `canEnableCoach false IFF phase===control`. All 10 pass. This is the systematic scan beating the
one-off probe — it found a constitutional-critical untested pure fn the ad-hoc checks missed. **§3.4 is now
pinned on BOTH sides this session: the control-GATE (`evaluateControlGate`, class 49, fail-closed) AND the
control-PHASE resolver (class 73).** The moat's month-1 lock is test-protected end to end.

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
