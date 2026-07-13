# Session closure — Financial System build (2026-07-11 → 07-12)

Single entry point for the founder's return. This session built the Financial Tracking &
Management System (FinancialSystem.md) from nothing to a **complete core accounting system**:
double-entry GL → transactions (AP/AR/Expenses) → periods → **financial statements + CSV export** →
Phase-2D (POs, recurring, aging both sides, collections).
Migrations **0116–0153**. Apply state (2026-07-13): founder applied **through 0144**. **Still to apply (see the 2026-07-13 late-session section at the bottom for the concurrency/robustness additions):
`0145`–`0153`** — Phase 3 Banking (0145), duplicate detection (0146), Phase 4 inc-1 (0147/0148), Phase
5 inc-1 (0149 budgeting/variance/runway), **Phase 7 (0150 tax codes + liability report, 0151 year-end
close)**. Phases 1, 2, 2D, **3**, Phase-6 reporting core, **Phase 4 inc-1**, **Phase 5 inc-1**, and
**Phase 7** are BUILT. Phase 9 mostly built (RBAC/SoD/encryption). Deferred per proposals: Phase-4
remainder, Phase-5 forecasts/scenario, tax 1099. Remaining: Phase 8 (proposed), Phase-9 gaps
(delegation/multi-entity/integrations — proposed). Tax auto-calc line picker = a fast follow.

**Also built after the Phase-2 core:** AR aging (0133); core financial statements — P&L, Balance
Sheet, Trial Balance, GL-detail drill-down RPC (0134) at /dashboard/finance/statements, with CSV
export. Statements are pure read-only derivations (no data model → the per-phase gate is vacuously
satisfied; consistent with the aging/dashboard readouts). All three subledgers authz-audited clean.

**Remaining (genuinely gated / needs founder), as of 2026-07-13:** Cash Flow Statement + advanced
reporting (PDF/Excel export, custom builder, scheduling); spend-limits/mileage/policy VALUES; the
Phase-4 remainder (overhead allocation, spend-anomaly, unit economics, break-even, inventory) — deferred
per the Phase-4 proposal; and Phases **5 (budget/forecast), 7 (tax), 8 (payroll/assets), 9 (governance)**
— each ADDS a data model → each needs a proposal + confirmation. (Phases 3 + 4-increment-1 are DONE — see
the top-of-doc state; the historical narrative below predates them.)

## What was built (migrations 0116–0140 + finance app surface)

**Phase 1 — Foundation (VERIFIED by founder: all acceptance scripts PASS)**
- 0116 settings + finance roles + capability helpers + platform-role→CFO bridge + Chart of Accounts
- 0117 fiscal periods (open/close/lock, non-overlap)
- 0118 double-entry ledger — two-layer DB-level balance enforcement (post-RPC + deferred triggers),
  debit-XOR-credit, SoD, posted/closed-period immutability, reversal
- 0119 multi-currency (rates + authoritative FX + fin_init_company COA seed)
- 0120 immutable append-only audit trail (generic trigger on all fin_ tables)
- 0121 derived-balance views + fin_dashboard_summary (all money math in SQL)

**Phase 2 — Transactions (verified by construction; runtime-verifiable via the UI now)**
- 0122 subledger→GL primitive (fin_post_system_entry) + source-linking + fin_account_by_code
- 0123 AP core — vendors, bills+lines, fin_approve_bill→GL (Dr expense/Dr tax / Cr AP)
- 0124 AP payments — fin_pay_bill→GL (Dr AP / Cr Cash), partial + over-pay guard
- 0125 Expenses — reports/items, approve→GL (SoD: not your own) → reimburse→GL

**Phase-2D enrichments + reporting + polish (0133–0140)**
- 0133 AR aging · 0134 statements (P&L/BS/TB + GL drill-down + CSV) · 0135 bill/invoice summary
  views · 0136 dashboard AR/AP outstanding · 0137 expense summary · 0138 AP aging · 0139 Purchase
  Orders (approve/convert-to-bill) · 0140 Recurring bills (template + generate + batch runner).
- App polish: FinanceNav cross-nav; amounts + drill-downs in AP/AR/Expenses lists; collections
  worklist (overdue invoices) on AR. New pages: /statements, /pos, /recurring.
- FLAGGED (need your input, not guessed): credit-notes/refunds (accounting-treatment choice —
  recommend Dr Sales-Returns-contra / Cr AR), spend-limit $ thresholds, mileage/per-diem rate,
  expense policy rules, corporate-card feed + OCR (integrations). **Migrations now 0116–0140.**

**Post-build adversarial audit (0126–0129) — 4 genuine issues found + fixed**
- 0126 fin_init_company seeds an open period (fresh company couldn't post → would break verification)
- 0127 fin_pay_bill locks the bill row (over-payment race)
- 0128 AP bills editable only while DRAFT (edit-after-approval integrity — missed analogue of the 0125 expense fix)
- 0129 config-immutability guards (base_currency + account type/normal_balance frozen once used)

**App surface**
- Finance dashboard wired to the real ledger (Initialize CTA, real Cash/Revenue/Expenses/Net,
  trial-balance integrity badge, real expense breakdown; AR/burn/runway honestly deferred, not mocked)
- API: /api/finance/summary, /init, /accounts, /periods(+/[id]), /ap/vendors, /ap/bills(+/[id]/approve,/pay),
  /expenses/reports(+/[id])
- UI: /dashboard/finance/{ap, expenses, periods} (functional first-pass, single-line/no-tax)

**APPLY STATE (updated 2026-07-13): founder applied through 0144. Migrations `0145`–`0148` still need
applying** (Phase 3 banking, duplicate detection, Phase 4 increment 1). The whole 0116–0148 chain is
dependency-ordered + idempotent. *(This section originally tracked 0122–0140; superseded — see the
top-of-doc apply state, which is authoritative.)*

## Governance record (the founder ran a strict per-phase protocol)

- Confirmed build params (7): multi-tenant RLS, existing stack, numeric(19,4) math-in-SQL, manual-FX
  API-ready, separate finance-role dim + exec/admin approval + SoD, COMPLETE from-scratch GL, Supabase encryption.
- Phase-1 model confirmed (5 decisions); Phase-2 model confirmed (bridge=A, system-post, tax-capture-only).
- **§0 correction (RESOLVED 2026-07-12):** the CRM is vendor-side only, so the original "Option A
  bridge" couldn't serve customer tenants. Founder chose **Option B (finance-native AR)** — BUILT
  (0131 fin_customers+fin_invoices+issue→GL, 0132 receipts→GL, + API/UI). Founder also confirmed
  adding **bill-approval SoD** (creator≠approver, 0130). **Phase-2 core (AP + AR + Expenses) is now
  COMPLETE + operational.** (Full apply range including Phase-2D: **0122–0140** — see top of doc.)

## 5 real defects self-caught + fixed before commit (all verified-by-construction only)
1. FX reversal negated at the wrong (reversal-date) rate → wouldn't balance; fixed via a trust flag.
2. Deferred balance trigger only on lines (never fired at post) → added the entries-level trigger.
3. fin_reverse_entry self-approved (broke SoD) → now a draft posted through the normal path.
4. Expense items editable after approval + employee self-approve via direct status write → RLS tightened.
5. A messy vendors route → rewritten with getCurrentCompanyId.

## What NEEDS the founder (open)
> ⚠️ **SUPERSEDED — this is a mid-session (0148-era) snapshot.** For the authoritative current open
> items, read the **2026-07-13 late-session section at the bottom of this doc** and
> **`docs/FOUNDER-ACTION-QUEUE.md`** (the prioritized menu): apply queue is now `0145`–`0153`, runbook is
> Steps 1–16, credit notes / Phase 3 / Phase 4-inc1 / Phase 5-inc1 / Phase 7 are BUILT, and every open
> decision (tax-netting, recurring-drift, Phase 8, Phase 9) has a decision-ready doc. The list below is
> kept for the historical record only.

1. **Apply `0145`–`0148` + walk the runbook** (VERIFICATION-RUNBOOK-FULL.md — now Steps 1–12 covering
   AP/AR/Expenses/POs/Recurring/Statements/CreditNotes/Banking/Profitability). You're through 0144; the
   whole chain is dependency-ordered + idempotent. Exercise banking (import CSV → auto-match) and
   profitability (tag lines → margin). Acceptance scripts in docs/financial-system/tests/ (through 0148).
2. **Credit notes — BUILT (2026-07-13, migration `0143`, UNAPPLIED).** Founder chose contra-revenue
   4900 / against-one-invoice / credit-notes-only. Full stack: `0143` + /api/finance/ar/credit-notes
   (+/[id]/issue) + /dashboard/finance/credit-notes. **Apply `0143`**, then create a draft credit note
   and have a second finance user Issue it (SoD). Cash refunds deferred (your credits-only choice).
3. **Recurring monthly-drift semantics** (surfaced 2026-07-12, test 0140): a bill due the 31st drifts
   to the 28th permanently after February. Keep calendar +1 month / anchor to day-of-month / last-day-
   of-month? Latter two need an `anchor_day` column.
4. **Phase-2D enrichment VALUES** — spend-limit thresholds, mileage/per-diem rate, expense policy
   rules (I can't guess these; they're your numbers).
5. **Phases 3–9** each start with a data-model proposal + confirmation (Phase-3 Banking proposal is
   already written: PHASE-3-DATA-MODEL.md — 3 decisions).

## Key files
- FEATURE_MANIFEST.md (status of every feature) · docs/financial-system/ (data-model proposals,
  acceptance tests, runbook, PHASE-3/4 proposals) · supabase/migrations/0116–0148 · src/app/dashboard/finance/ + src/app/api/finance/

---

## 2026-07-13 — post-build edge-case review sweep (supersedes the apply/open lists above)

After the full build, I swept the money-critical + newest functions for edge cases. The recurring
defect shape: **an invariant enforced on one path but silently absent on its twin.** Three real bugs
found + fixed, one §3.4 accuracy gap flagged (needs a decision), two functions confirmed clean.

**Fixed (all ship in the still-unapplied migrations or in routes — apply queue unchanged, `0145`–`0151`):**
1. `e7ccea8` — **year-end close**, net income exactly 0 → the Retained-Earnings line was `debit 0 /
   credit 0`, which violates the ledger's `(debit>0) <> (credit>0)` CHECK → close would fail. Fix:
   omit the RE line when net = 0 (the P&L lines already balance). In `0151`.
2. `795b62e` — **zero-amount document lines** (bill/invoice/expense/credit-note) → a `0/0` P&L line →
   same constraint violation → approve/issue fails cryptically. Fix: require line amount **> 0** at
   input (routes; live on deploy, no migration).
3. `b23b032` — **manual bank-match** (`fin_match_bank_txn`) lacked the 1:1 entry↔bank-line guard that
   `fin_auto_match_bank` has → one GL entry reconcilable against two bank lines (rec state wrong; GL
   untouched). Fix: mirror the exclusion in the manual path. In `0145`.
4. `a0e4b7a` — **year-end close targeted a phantom Retained Earnings 3900** (only a one-time 0150
   backfill), while `fin_init_company` seeds RE as `3000`. Any company initialized AFTER the migrations
   applied would have no 3900 → close fails "Retained Earnings (3900) missing" despite being
   initialized; backfilled companies got duplicate "Retained Earnings" accounts. Found by a
   cross-migration account-code audit (referenced-vs-seeded codes) — invisible to per-function review
   because the mismatch is BETWEEN init and the close. Fix: close targets 3000; 3900 seed dropped. In
   `0150`/`0151`.

**Flagged — NEEDS A DECISION (not silently fixed, per §3.3):**
4. `7cced29` — **`fin_tax_report` is not netted for credit-note reversals.** output_tax is the gross
   sum of invoice-line tax; it never subtracts the output tax that issued credit notes reverse (Dr
   2100). A period with credited invoices **overstates the tax owed** (the GL 2100 balance is correct;
   only this report is un-netted). Netting is not mechanical — **credit-note lines carry no
   `tax_code_id`, hence no jurisdiction.** Decision needed: attribute a credit note's tax to (a) its
   linked invoice's jurisdiction, (b) proportionally across the invoice's tax codes, or (c) an
   "Unassigned" bucket? A visible amber warning is live on the Tax page + a code note in `0150` so no
   one files a wrong number meanwhile. **This is the top new open item.**

**Confirmed clean (reported sound, not dressed up as findings — §3.4):** `fin_issue_credit_note`
(over-credit guard correct, tax reversal consistent with the invoice's 2100 output-tax leg);
`fin_post_system_entry` + `fin_approve_bill` + `fin_issue_invoice` dimension threading (cost_center_id/
project_id flow source line → jsonb → journal line → profitability GROUP BY, control lines NULL).

**API-route security verification (2026-07-13, clean):** all 42 finance routes audited — **zero use
service-role** (`createAdminClient`/service_role absent everywhere), every route enforces
`if (!auth.user) return 401` per handler, write routes also gate `supabaseEnabled`, all use the
user-scoped `createClient` so RLS + the `fin_can_*` DEFINER checks enforce authorization at the DB
layer (the correct two-layer model). The routes added this session (bank/*, budgets/*, profitability,
runway, tax-codes, tax-report, close-year, dimensions, credit-notes/*) all conform. No exposure found.
**Table-RLS audit (clean):** all 34 `fin_` tables have `enable row level security` + company-scoped
policies; DEFINER-written tables (receipts, payments, source_postings, entry_counters, audit_log,
reconciliation_matches, year_closes) are correctly SELECT-only (`company_id = auth_company_id()`, no
`using (true)`), with writes only through SECURITY DEFINER fns. Full isolation model verified airtight:
tables (RLS+scoped) → views (security_invoker) → routes (auth-gated, user-scoped) → writes (DEFINER +
capability + SoD).
**View-isolation audit (clean):** every finance view sets `security_invoker = true` inline (0121–0149);
the older cross-subsystem views were retrofitted via `alter view` in `0052` (+ chat re-set in `0076`),
so no view bypasses RLS → no cross-tenant leak. **Account-code audit (clean after the 3900→3000 fix):**
every code a function resolves-and-raises-on is seeded by `fin_init_company`; 4900 self-heals.

**UI robustness (2026-07-13, `acd8044`):** all 11 finance pages' `load()` now handle fetch failure
(try/catch → toast) instead of silently blanking — AMD-006 layer-4 gap, fixed across every page.

**Decision-ready artifacts (all reviewed for latent bugs this session):**
- `docs/financial-system/TAX-CREDIT-NOTE-NETTING-DECISION.md` — the tax-netting call, 3 options +
  recommendation (A: proportional to the linked invoice's jurisdictions).
- `docs/financial-system/PHASE-8-DATA-MODEL.md` — Payroll (post, don't build) + Assets (register +
  depreciation + disposal). Proposal-reviewed: fixed a payroll-entry balance bug + pinned depreciation
  salvage-floor / active-only / gain=proceeds−NBV rules.
- `docs/financial-system/PHASE-9-DATA-MODEL.md` — delegation + opening-balance import. Proposal-
  reviewed: pinned the delegation SoD-bypass rules (actor-checked, non-transitive, no role upgrade) +
  honest-import rule (Opening Balance Equity surfaces imbalance, never silent-plugs).

**Current apply queue (authoritative):** founder is through `0144`; **`0145`–`0151` outstanding**
(`0145`/`0150`/`0151` now carry the sweep fixes). Runbook is Steps 1–15 (adds Banking, Profitability,
Budget, Tax + year-end close). Then confirm **Phase 8** (payroll/assets, proposed) and the **Phase-9
gaps** (delegation/multi-entity/integrations, proposed). New decision #4 above rides alongside these.

---

## 2026-07-13 (late session) — concurrency + import-robustness sweep (updates the apply queue to 0145–0153)

Continued forming genuine defect hypotheses. The most productive vein was **concurrency (row locks)**:
a §1.2 sweep of "every read-guard-post function must `SELECT … FOR UPDATE` its document" (which
`fin_pay_bill`/`fin_record_receipt` already did) found **six** functions missing it — all invisible
under single-user testing, all real under concurrent load:

- `0147` — `fin_approve_bill` / `fin_issue_invoice` / `fin_approve_expense_report` (edited in place,
  unapplied): concurrent approval of one draft → **double-post** (double expense/revenue). `fin_source_
  postings` has no unique constraint to catch it.
- `0152` — `fin_issue_credit_note` (new migration; 0143 applied): concurrent issue → **over-credit**.
- `0153` — `fin_reimburse_expense_report` (**double payment**) + `fin_convert_po_to_bill` (**duplicate
  bill**) (new migration; 0125/0139 applied).

Row-lock discipline is now uniform across the whole finance write surface. Other late finds:
- **Import robustness** (`14d4263`, `a5c1ecd`, `114fd5c`): extracted + tested the bank CSV parser;
  fixed a **UTF-8 BOM** bug (Excel exports broke first-column exact-match → dropped dedup id) and
  **silent row-drop** (unreadable lines vanished; now `parseCsv` returns `{rows, skipped}` and the UI
  warns) — both real data-integrity gaps on financial import.
- **Timezone** (`c66a091`, `5032f17`): `isoAdd` parsed date-only strings as UTC → period-over-period
  window off a day in the Americas; and pay/receive/PO-bill defaults used UTC-today (→ next-day, month-
  end misfiling). Fixed + tested under multiple TZs.
- **Deploy gates**: fixed 2 unused-import lint errors that could fail `next build`; verified `next
  build` compiles, PG15+ prerequisite met, 0145–0153 idempotent + gap-free.
- **Verified clean** (genuine hypotheses, no defect): XSS (`dangerouslySetInnerHTML` — finance has none;
  2 app-wide uses are static), API input-validation (every mutating route Zod-parses its body),
  CWE-1236 CSV-export (only `statementsToCsv`, neutralized + tested), dead-code/wiring (all unreferenced
  fns are triggers/helpers or documented deferrals), manual amount-entry (fails safe, conventional).

**Flagged (not auto-applied), in `docs/FOUNDER-ACTION-QUEUE.md`:** (a) a `fin_source_postings
(source_type, source_id, kind)` unique-index **structural backstop** for the double-post class — safe by
design but could halt the apply if a pre-lock duplicate exists, so gated on a dup-check query; (b) a
**latent double-reversal** gap in `fin_reverse_entry` (currently unreachable — no UI/route — fix the
already-reversed guard before shipping a reverse button).

**Current apply queue (authoritative, supersedes "0145–0151" above):** founder is through `0144`;
**`0145`–`0153` outstanding.** Runbook Step 1 + the action queue reflect the range. App code ships
green (tsc 0, ESLint 0, 619 vitest, `next build` compiles).

---

## 2026-07-13 (late) — app-wide audit (broadened beyond finance under the build guard)

Applied the discipline-consistency methodology (that found the finance row-locks) to the WHOLE app:
- **Tenant isolation — SOUND app-wide:** all 97 tables have RLS enabled (verified past a grep
  whitespace false-negative); NO `using(true)`/`with check(true)` policy exists (case-insensitive);
  all 17 views set `security_invoker`. A member of company A cannot read/write company B via any
  table/view.
- **Service-role routes (27 non-finance) — SOUND on the sample:** the worst-looking-by-grep (files,
  care agent+customer messages) all enforce tenant scoping (auth.companyId + explicit company-match, or
  session-token for customer-facing) — two show prior F1/F7 audit fixes. Grep is unreliable here
  (domain auth helpers + camelCase), so an exhaustive per-route read is the only way to fully close it;
  the high-risk sample is clean.
- **Concurrency (DB DEFINER fns) — finance-specific:** no non-finance DEFINER fn has the read-guard-
  post-side-effect pattern; `accept_invitation` is race-safe via `on conflict(id)` idempotency.
- **Config: rate-limiting SOUND** (84 routes, coach LLM routes throttled); **`maxDuration` — ONE REAL
  GAP:** ~10 coach/care LLM-generation routes import an LLM lib + `await` a generation call but lack
  `export const maxDuration` (no global config either) → can time out at Vercel's default. Precise
  12-route list + one-line fix in FOUNDER-ACTION-QUEUE.md. Rate-limited, so it's a reliability gap not
  a cost/DoS one. Class was "swept 2026-07-09" per a comment — these were added/missed after.

Method note: caught grep false-negatives twice (RLS whitespace alignment; camelCase `auth.companyId`)
and false-positives twice (care token-scoping looked like IDOR; health/settings LLM-config refs) —
verified each by reading before flagging (§3.4 both directions). One real finding (coach maxDuration);
everything else app-wide is sound.

## 2026-07-13 (continuation, autonomous under the A23 guard) — fixes shipped + a core-ledger discovery

⚠️ **READ FIRST — item 0 in FOUNDER-ACTION-QUEUE.md:** a deploy-readiness `git status` found
`0118_fin_ledger.sql` **modified but UNCOMMITTED** — a reversal-SoD/FX/balance-trigger redesign not in
my edit record (your WIP or a stray edit). I left it **untouched** (surface, don't overtake). It does NOT
block the apply queue (verified: no committed migration references its new fns), and — key — since you're
applied through `0144`, editing `0118` in place is a **no-op on your live DB**; the redesign would need a
new forward migration `0154+`. Full characterization + keep-or-revert steps are in the queue item 0.

**Real fixes shipped this continuation (all tested, committed, pushed):**
- **maxDuration class CLOSED** (the prior "flagged" item, now fixed + verified): swept all API routes via
  transitive-import closure + a rateLimit↔maxDuration cross-check. Real catch: **`upload-recording` awaits
  an in-path full-recording TRANSCRIPTION with no budget → times out for any real recording** (set 300).
  Also `attribute`/`realtime-token`. Reverted 2 over-flags (dissect topic CRUD). No route on `edge`.
- **`care/agent/…/messages` rate-limit** wired (ratified 2026-07-06 policy omission).
- **Money-rounding: `computeLineTax` rounded the half-cent DOWN** (toFixed float quirk) → fixed to
  integer-cent rounding; §1.2 class-checked (only JS float×rate site). **FX per-line rounding drift in the
  ledger core FLAGGED** (latent/safe-failing — rejects, never corrupts; FOUNDER-ACTION-QUEUE latent section).
- **Bank CSV import hardened**: parenthesized/trailing-minus withdrawals now parse (were skipped →
  reconcile-breaking); European day-first dates no longer import as invalid month-25 (whole-import failure);
  blank amount no longer a phantom $0. **Finance form amount fields** now accept `$`/comma-formatted money
  across all 7 pages (`parseMoneyInput`) — a bare `Number()` used to NaN them. Date entry verified safe
  (`type=date`).
- **Tests hardened**: tie-out one-cent boundary + trialBalances symmetry; **628 vitest** green, tsc 0, ESLint 0 (whole src).

**Verified sound this continuation (read-earned, not rubber-stamped; scary regex results traced to
formatting artifacts, not flagged):** all 6 core-thesis controls (§3.1 append-only across 11 tables via
service-role-proof rules/triggers; §3.2 gate w/ meaningful 3/2/80 thresholds; §3.3 guide-don't-overtake at
the input contract; §3.4 guidance suppression; §3.5 measures consequence not agreement; finance ledger
immutability). Committed migration chain apply-safe (no dangling `fin_*` fn refs). Finance tenant isolation:
**34/34 tables RLS-enabled + 34/34 have a company-scoped select policy**. Full continuation log: the commit history from `391b6a4` onward, and FOUNDER-ACTION-QUEUE.md (item 0 first).
