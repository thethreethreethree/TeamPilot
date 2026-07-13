# Session closure — Financial System build (2026-07-11 → 07-12)

Single entry point for the founder's return. This session built the Financial Tracking &
Management System (FinancialSystem.md) from nothing to a **complete core accounting system**:
double-entry GL → transactions (AP/AR/Expenses) → periods → **financial statements + CSV export** →
Phase-2D (POs, recurring, aging both sides, collections).
Migrations **0116–0151**. Apply state (2026-07-13): founder applied **through 0144**. **Still to apply:
`0145`–`0151`** — Phase 3 Banking (0145), duplicate detection (0146), Phase 4 inc-1 (0147/0148), Phase
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
