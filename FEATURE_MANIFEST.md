# FEATURE_MANIFEST.md — Financial Tracking & Management System

Authoritative status of every feature in `FinancialSystem.md` section 4. Per section 2.2, nothing is
silently dropped: every row ends at **BUILT** / **TESTED** or **FLAGGED (reason + your decision)**.

**Status legend:** `NOT_STARTED` · `IN_PROGRESS` · `BUILT` · `TESTED` · `FLAGGED (reason)`

**Confirmed build parameters (founder, 2026-07-10):** multi-tenant RLS-isolated per company ·
existing stack (Next.js/TS/Supabase/Vercel) · money `numeric(19,4)`, all math in SQL ·
manual FX now, API-ready · separate finance-role dimension, approval gated to Executive/Admin
(SoD enter≠approve) · COMPLETE from-scratch double-entry GL · Supabase platform encryption.

---

## PHASE 1 — Foundation
| Feature | Status |
|---|---|
| Chart of Accounts (COA) — configurable account tree (Asset/Liability/Equity/Revenue/Expense + sub-accounts) | BUILT (0116; acceptance script docs/financial-system/tests/0116_foundation.test.sql — awaiting live-DB run to reach TESTED) |
| Double-entry general ledger — balanced debits/credits every transaction | BUILT (0118; two-layer DB balance enforcement [post-RPC + deferred constraint triggers on BOTH entries and lines], debit-XOR-credit CHECK, server-computed base amounts, posted+closed-period immutability. Acceptance: tests/0118_ledger.test.sql — awaiting live-DB run) |
| Journal entries — manual + automated, with approval workflow | BUILT (0118; draft→post via fin_post_entry with approver-role gate + SoD [approved_by<>created_by] + open-period + balance checks; fin_reverse_entry creates an SoD-preserving draft reversal. App UI for the workflow is a later Phase-9/UI increment) |
| Fiscal periods — open/close; closed periods locked | BUILT (0117; table + non-overlap + close/reopen/lock RPCs. The closed-period IMMUTABILITY trigger on entries ships with the ledger, Increment 3. Acceptance: tests/0117_periods.test.sql — awaiting live-DB run) |
| Multi-currency support — exchange rates, FX gain/loss | BUILT (0119; fin_exchange_rates + fin_get_rate + authoritative FX in base-amount computation + fin_init_company COA seed incl. FX Gain/Loss account. REALIZED FX gain/loss posting is at settlement, Phase 2; period-end unrealized revaluation FLAGGED for later. Acceptance: tests/0119_multicurrency.test.sql) |
| Immutable audit trail — append-only who/what/when/prior-value | BUILT (0120; generic fin_audit trigger on all 7 fin_ tables → fin_audit_log with actor/action/before/after; append-only trigger rejects UPDATE/DELETE even from service role. Acceptance: tests/0120_audit.test.sql) |

*Increment 1 (0116) also laid the foundation for Phase 9's RBAC + SoD: `fin_settings` (base
currency), `fin_roles` (the 5-role finance dimension), and the `fin_effective_role()` /
`fin_can_*` capability helpers with the platform-role→CFO bridge. Those Phase-9 rows stay
NOT_STARTED until their full scope (delegation, etc.) is built, but the authority spine is in.*

## PHASE 2 — Transactions
**Accounts Payable**  *(0122 subledger foundation: fin_post_system_entry + fin_source_postings + fin_account_by_code)*
| Feature | Status |
|---|---|
| Vendor / supplier master records | BUILT (0123 fin_vendors; acceptance tests/0123_ap_core.test.sql — awaiting live-DB run) |
| Purchase orders | BUILT (0139 fin_purchase_orders + fin_po_lines + approve/convert-to-bill; API + /dashboard/finance/pos. No GL impact until converted) |
| Bill / invoice capture and entry (file ingestion / OCR) | BUILT — manual entry (0123 fin_bills + fin_bill_lines + fin_approve_bill→GL). FLAGGED: OCR/file-ingestion recommended as a document-AI INTEGRATION (build-vs-buy), your call |
| Payment scheduling and execution | BUILT (0124 pay path + 0158 fin_payment_schedules + fin_payments_due view + schedule/execute/cancel RPCs; aggregate over-schedule guard + row lock; execution delegates to the existing fin_pay_bill so there is ONE posting path; rails are external per spec 2.1. API /api/finance/ap/schedules + UI /dashboard/finance/schedules. Acceptance tests/0158-0160 — awaiting live-DB run to reach TESTED) |
| Recurring expenses (rent, subscriptions, utilities) | BUILT (0140 fin_recurring_bills template + generate + batch runner; API + /dashboard/finance/recurring. Auto-generation needs cron wiring) |
| Approval workflows with role-based spend limits | BUILT (0157 fin_roles.approval_limit + BEFORE-UPDATE triggers on bills AND expense reports; gross total, numeric(19,4), DB-enforced. A23-verified: an approver lacks fin_can_configure() so cannot raise their own ceiling. API /api/finance/roles + UI /dashboard/finance/controls. Acceptance tests/0157 — awaiting live-DB run to reach TESTED) |

**Accounts Receivable**  *(Option B finance-native; 0131 core + 0132 receipts + API/UI)*
| Feature | Status |
|---|---|
| Customer master records | BUILT (fin_customers + API/UI) |
| Invoice generation and delivery | BUILT — generation (fin_invoices + fin_issue_invoice→GL, SoD issuer≠creator). Delivery (email/PDF) FLAGGED follow-up |
| Payment tracking and application | BUILT (fin_receipts + fin_record_receipt→GL; partial + over-receipt guard + row lock) |
| Aging reports (30/60/90) | BUILT (0133 fin_ar_aging view + summary RPC + AR-page buckets panel) |
| Dunning / collections workflow | BUILT (0159 fin_dunning_policies ladder + fin_dunning_events APPEND-ONLY via do-instead-nothing rules + fin_dunning_worklist showing stage_due vs stage_actioned — the gap IS the backlog. Records, does not send. API /api/finance/ar/dunning + UI /dashboard/finance/collections. Acceptance tests/0158-0160 — awaiting live-DB run to reach TESTED) |
| Credit notes and refunds | BUILT (credit notes) — 0143 fin_credit_notes + lines + fin_issue_credit_note (Dr Sales Returns 4900 / Cr AR, contra-revenue; SoD creator≠issuer; over-credit guard; created_by pinned+frozen per 0142); fin_invoice_summary + fin_ar_aging subtract issued credits; API /api/finance/ar/credit-notes(+/[id]/issue); UI /dashboard/finance/credit-notes. Founder decisions: contra-revenue 4900, against-one-invoice, credit-notes-only. CASH REFUNDS deferred (founder chose credits-only now) |

**Expense Management**  *(0125)*
| Feature | Status |
|---|---|
| Employee expense submission (receipt capture) | BUILT (fin_expense_reports + fin_expense_items, receipt_url field; submission open to any company member — FLAGGED access-model decision) |
| Expense categorization | BUILT (category field per item) |
| Reimbursement workflow and approvals | BUILT (fin_approve_expense_report→GL with employee≠approver SoD; fin_reimburse_expense_report→GL) |
| Corporate card transaction reconciliation | BUILT (0160 fin_corporate_cards + fin_card_transactions + fin_card_matches; mirrors the 0145 bank-recon precedent. Auto-match refuses to guess between two candidate claims — a false match silently defeats the unsubstantiated-spend control. Reuses the hardened parseCsv. API /api/finance/cards/* + UI /dashboard/finance/cards. Acceptance tests/0158-0160 — awaiting live-DB run to reach TESTED) |
| Mileage / per-diem handling | BUILT (0161 effective-dated fin_mileage_rates + fin_per_diem_rates; expense items gain kind+quantity. Amount is DERIVED BY TRIGGER — round(rate*qty,4) — never client-supplied; rates are configure-level so a claimant cannot value their own claim. API /api/finance/rates + UI /dashboard/finance/controls. Acceptance tests/0161 — awaiting live-DB run to reach TESTED) |
| Policy enforcement (limits, disallowed categories) | BUILT (0162 fin_expense_policies enforced by a DB trigger on the expense line — a policy in the UI only would be a false guarantee. Checked on the GROSS line so tax cannot push a claim past its cap. Fires AFTER 0161's derivation so mileage is policed on the derived amount. API /api/finance/expense-policies + UI /dashboard/finance/controls. Acceptance tests/0162 — awaiting live-DB run to reach TESTED) |

## PHASE 3 — Banking & Reconciliation
| Feature | Status |
|---|---|
*Phase 3 BUILT 2026-07-13 (migration 0145, founder-confirmed: CSV-first, one GL cash account per bank, ±3-day match). UI: /dashboard/finance/banking.*
| Bank account management (multiple accounts) | BUILT (0145 fin_bank_accounts, each linked to its own cash GL account; configure-gated; add/list via /banking) |
| Bank feed integration (Plaid or equiv) **or** statement import | BUILT — CSV statement import (client-parses date/amount/desc/ref → deduped insert on external_id). Plaid is a later drop-in via the same fin_bank_transactions shape (source='plaid') |
| Automated transaction matching to ledger | BUILT (0145 fin_auto_match_bank: equal signed amount + ±3-day + single-candidate → links fin_reconciliation_matches, flips status. Acceptance: tests/0145) |
| Manual reconciliation interface for unmatched items | BUILT (0163 fin_reconcile_create_entry creates+posts+matches the missing entry for a bank line nobody recorded (fee/interest/FX). Direction DERIVED from the line's sign — a backwards entry still BALANCES so no downstream check would catch a fee booked as income; the UI offers no way to express a direction. Posts via fin_post_system_entry. API + banking-page affordance. Acceptance tests/0163 — awaiting live-DB run to reach TESTED) |
| Real-time cash position dashboard | BUILT (fin_bank_positions view: each bank account's linked GL cash balance + unmatched count, on /banking) |

## PHASE 4 — Cost, Profitability & Waste
**Cost tracking**
| Feature | Status |
|---|---|
| Cost centers / departments | BUILT (0147 fin_cost_centers, tree via parent_id; create on /profitability; tag lines) |
| Project & job costing | BUILT (0147 fin_projects + client link + optional budget; tag bill/invoice lines with a project; margin on /profitability) |
| Direct vs. indirect cost classification | BUILT (0147 fin_accounts.cost_type direct/indirect/none; drives contribution margin) |
| Cost of Goods Sold (COGS) tracking | NOT_STARTED |
| Overhead allocation rules | NOT_STARTED |

**Profitability analysis**
| Feature | Status |
|---|---|
| Gross margin — by product/service/client/project/region | PARTIAL — margin by PROJECT + COST CENTER built (0148 views + /profitability). Product/region are later dimensions |
| Net profitability by segment | NOT_STARTED |
| Contribution margin analysis | BUILT (0148 revenue − DIRECT cost per dimension) |
| Unit economics (cost per unit/customer/transaction) | NOT_STARTED |
| Customer profitability | BUILT (0148 fin_customer_profitability — rolls project margin up by the project's client link) |
| Break-even analysis | NOT_STARTED |

**Waste & efficiency**
| Feature | Status |
|---|---|
| Budget vs. actual variance analysis | BUILT (0149 fin_budget_variance — the same variance engine as Phase 5's "budget vs actual tracking"; budget vs posted actuals by account × cost-center × quarter, direction-colored, threshold in fin_settings.variance_alert_pct) |
| Unused / underutilized resource tracking | NOT_STARTED |
| Spend anomaly detection | NOT_STARTED |
| Duplicate payment detection | BUILT (0146 fin_duplicate_bill_candidates view — same vendor + same total, ≤7 days apart; /api/finance/ap/duplicates + a "Possible duplicate bills" review prompt on the AP page. A candidate, not a verdict. Shipped ahead of Phase-4 — no data model / decision needed) |
| Cost-per-outcome metrics | NOT_STARTED |
| Inventory waste / shrinkage (if applicable) | NOT_STARTED |

## PHASE 5 — Budgeting & Forecasting
| Feature | Status |
|---|---|
| Budget creation (annual/quarterly, by dept & cost center) | BUILT (0149 fin_budgets + fin_budget_lines, account × cost-center × quarter; /dashboard/finance/budgets) |
| Budget vs. actual tracking with variance alerts | BUILT (0149 fin_budget_variance view — budget vs posted actuals by account × cost-center × quarter; variance colored by direction; threshold in fin_settings.variance_alert_pct default 10%. Acceptance: tests/0149) |
| Rolling forecasts | NOT_STARTED — deferred to Phase-5 increment 2 (per proposal) |
| Cash flow forecasting / projection | NOT_STARTED — deferred to Phase-5 increment 2 |
| Scenario modeling | NOT_STARTED — deferred to Phase-5 increment 2 (needs assumptions) |
| Runway calculation | BUILT (0149 fin_runway: cash / avg-3mo monthly burn; on /budgets. Cash uses the dashboard cash-name heuristic — flagged) |

## PHASE 6 — Reporting
**Core financial statements**  *(0134 fin_statements — derived, read-only; /dashboard/finance/statements)*
| Feature | Status |
|---|---|
| Profit & Loss (Income Statement) | BUILT |
| Balance Sheet | BUILT (ties out to the accounting equation) |
| Cash Flow Statement | NOT_STARTED (needs cash-movement categorization — later) |
| Trial Balance | BUILT (+ the fin_trial_balance view from 0121) |
| General Ledger detail report | BUILT (fin_gl_detail RPC; per-account drill-down — UI drill-in a small add) |

**Management reporting**
| Feature | Status |
|---|---|
| Custom report builder | NOT_STARTED (advanced Phase 6) |
| KPI dashboard (revenue, burn, margin, runway, DSO, etc.) | PARTIAL — finance dashboard shows real derived cash/revenue/expenses/net + trial-balance integrity; burn/runway/DSO need forecasting (Ph5) + AR-days |
| Period-over-period comparison | BUILT — date-ranged statements (0144) + a "Period over period" P&L card on /statements comparing the selected period vs the prior same-length window (revenue/expenses/net income Δ + %). UI-only, reuses fin_statements(from,to) |
| Drill-down from summary to source transaction | BUILT (0134 fin_gl_detail + Trial-Balance click-through on /dashboard/finance/statements) |
| Scheduled / automated report delivery | NOT_STARTED (advanced Phase 6) |
| Export (PDF, Excel, CSV) | PARTIAL — CSV built (opens in Excel), hardened against formula injection (CWE-1236, csvSafe.ts); PDF/native-xlsx later |

## PHASE 7 — Tax & Compliance
| Feature | Status |
|---|---|
| Tax code configuration (VAT/GST/sales tax by jurisdiction) | BUILT (0150 fin_tax_codes — rate × jurisdiction × direction; /dashboard/finance/tax) |
| Tax calculation on transactions | BUILT — tax posts to 2100/1200; bill/invoice line editors have a tax-code picker (input codes on bills, output on invoices) that auto-computes tax_amount = amount × rate (overridable). tax_code_id stored on the line for jurisdiction reporting |
| Tax liability tracking | BUILT (0150 fin_tax_report — output − input tax by jurisdiction/period from source lines; on /tax) |
| Tax filing reports | BUILT (fin_tax_report by period + jurisdiction; the filing figure) |
| Contractor / 1099 (or local equiv) reporting | NOT_STARTED — deferred (jurisdiction-specific; founder to flag if needed) |
| Year-end close process | BUILT (0151 fin_close_year: posts closing entries revenue/expense → Retained Earnings 3000 [the account fin_init_company seeds] + locks the year; fin_reopen_year reverses + unlocks. Also fixes the ranged-BS caveat. Acceptance: tests/0150-0151) |

## PHASE 8 — Payroll & Assets
**Payroll** *(integration likely preferred — recommend at build time)*
| Feature | Status |
|---|---|
| Payroll expense posting to ledger | NOT_STARTED |
| Employee compensation tracking | NOT_STARTED |
| Benefits and employer contributions | NOT_STARTED |
| Payroll tax liabilities | NOT_STARTED |

**Assets**
| Feature | Status |
|---|---|
| Fixed asset register | NOT_STARTED |
| Depreciation schedules with automated entries | NOT_STARTED |
| Asset disposal handling | NOT_STARTED |
| Inventory management & valuation (if applicable) | NOT_STARTED |

## PHASE 9 — Platform & Governance
| Feature | Status |
|---|---|
| Role-based access control (accountant, controller, CFO, approver, viewer) | BUILT (0116 fin_roles 5-role dimension + isAdminRole-style capability helpers + platform admin/CEO/COO→CFO bridge) |
| Segregation of duties (enter ≠ approve) | BUILT (enforced in fin_post_entry, fin_approve_bill [0130], fin_approve_expense_report — creator/employee ≠ approver at the DB level) |
| Approval workflows and delegation | NOT_STARTED |
| Multi-entity support and consolidation | NOT_STARTED |
| Data import / export and migration tools | NOT_STARTED |
| Integration layer (bank feeds, Stripe, CRM, payroll, external accounting) | NOT_STARTED |
| Encryption at rest and in transit | BUILT — Supabase platform encryption at rest + TLS in transit (founder decision #7); column-level encryption flagged only if a named compliance regime requires it |
| Backup and recovery | NOT_STARTED |

---

*Updated as built per section 2.2. **State at 2026-07-13 (migrations 0116–0151):**
**Phase 1** — BUILT + founder-VERIFIED (acceptance scripts PASS).
**Phase 2** core — AP + AR (Option B) + Expenses BUILT + operational (backend + API + UIs).
**Phase 2D** enrichments — POs (0139) + recurring bills (0140) + AR/AP aging (0133/0138) + collections
worklist + credit notes (0143) BUILT; dunning PARTIAL (worklist built, email = integration);
card-recon/mileage/policy NOT_STARTED (need values/integrations).
**Phase 3** — BUILT (0145 banking/import/auto-match/reconcile + 0146 duplicate detection).
**Phase 4** increment 1 — BUILT (0147 cost centers/projects/direct-indirect + 0148 project/cost-center/
customer profitability + contribution margin). Deferred: COGS, overhead alloc, unit economics,
break-even, net-by-segment, region/product margin, anomaly/idle/cost-per-outcome/inventory waste.
**Phase 5** increment 1 — BUILT (0149 budget + variance + runway). Deferred: rolling forecasts, cash-
flow projection, scenario modeling.
**Phase 6** core — P&L, Balance Sheet, Trial Balance, GL drill-down, period-over-period, CSV export
(formula-injection hardened) BUILT; Cash Flow + custom builder + scheduling + PDF/xlsx NOT_STARTED.
**Phase 7** — BUILT (0150 tax codes/calc/liability/filing report + 0151 year-end close→RE 3000). Deferred: 1099.
**Phase 8** — PROPOSED (docs/financial-system/PHASE-8-DATA-MODEL.md, reviewed build-ready), awaiting confirmation.
**Phase 9** — RBAC, SoD, encryption, backup (Supabase) BUILT; approval-delegation + opening-balance
import PROPOSED (PHASE-9-DATA-MODEL.md, reviewed build-ready); multi-entity + full integration-layer deferred.
Everything Phase-2+ is verified-by-construction; hardened this session across EIGHT audit angles (money-
logic, API routes, UI load-errors, UI mutation-errors, cross-migration account codes, view isolation,
table RLS, DEFINER tenant-safety) with 7 defects fixed — see docs/closures/2026-07-11-financial-system-session.md. One open
FINANCE decision: tax-report credit-note netting (TAX-CREDIT-NOTE-NETTING-DECISION.md). Apply 0122–0151 to
a live DB + run the acceptance scripts / VERIFICATION-RUNBOOK-FULL.md (Steps 1–15) to reach TESTED.*
