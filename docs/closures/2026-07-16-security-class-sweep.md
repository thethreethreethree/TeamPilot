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
