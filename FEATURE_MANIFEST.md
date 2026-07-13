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
| Cash Flow Statement | BUILT (0164 fin_cash_flow + fin_cash_flow_summary + fin_cash_accounts; DIRECT method from actual cash-account movements, classified by the counter-account. Cash-to-cash transfers EXCLUDED (they inflate inflow+outflow while nothing real happens); multi-line entries split PROPORTIONALLY. Unattributable movement surfaces as 'unclassified' rather than being absorbed into Operating — the net change ties out either way, so a misclassified section is invisible to every balance check. API /api/finance/statements/cash-flow + rendered on /dashboard/finance/statements. Investing is empty until the Phase-8 asset register exists (an unbuilt feature, not a company that buys nothing). Acceptance tests/0164 — awaiting live-DB run to reach TESTED) |
| Trial Balance | BUILT (+ the fin_trial_balance view from 0121) |
| General Ledger detail report | BUILT (fin_gl_detail RPC; per-account drill-down — UI drill-in a small add) |

**Management reporting**
| Feature | Status |
|---|---|
| Custom report builder | BUILT (0171 fin_report_definitions + fin_run_report + API /api/finance/reports + UI /dashboard/finance/reports). THE DESIGN IS THE ABSENCE OF STORED SQL: a report is four choices from four CHECK-constrained enums (measure / group-by / optional account type / relative period), never a query. The obvious implementation — store the user's query, run it later — points an arbitrary-SQL path at the GL, and worse, a report engine naturally wants to be SECURITY DEFINER, which runs the user's query with the DEFINER's authority rather than the reader's; RLS protects tables, not a query you constructed and executed with elevated rights. All the SQL lives in fin_run_report, written once, with auth_company_id() HARD-WIRED into the WHERE clause — not a parameter, so no caller can name another tenant. Costs real capability (a report we can't express must be asked for); the alternative's worst case is a cross-tenant ledger dump. Also: closing_balance ignores the window start (a balance over one month is a MOVEMENT wearing a balance's name); signs normalized to each account's normal side (else revenue and expenses carry opposite signs in one column and sum to something meaningless that looks like profit); period is RELATIVE, resolved at run time (an absolute range goes stale invisibly); posted entries only. Acceptance tests/0171 asserts what a user CANNOT express. Awaiting live-DB run to reach TESTED |
| KPI dashboard (revenue, burn, margin, runway, DSO, etc.) | BUILT (0165 fin_kpis: burn, runway, DSO, gross+net margin, cash, AR — trailing 12 months. EVERY RATIO RETURNS NULL rather than a plausible-looking number when its denominator is absent: runway=0 would say 'out of money today' when the truth is 'not burning'; DSO=0 would say 'customers pay instantly'; a margin without COGS would report ~100% and look like triumph. gross_margin_pct is NULL until a COGS account exists (COGS lands with inventory, last) and net_margin_pct is exposed alongside it, clearly named — two honest numbers beat one confident wrong one. The UI states the REASON a ratio is missing rather than rendering a dash the user reads as a bug. API /api/finance/kpis + KpiStrip on /dashboard/finance. Acceptance tests/0165 — awaiting live-DB run to reach TESTED) |
| Period-over-period comparison | BUILT — date-ranged statements (0144) + a "Period over period" P&L card on /statements comparing the selected period vs the prior same-length window (revenue/expenses/net income Δ + %). UI-only, reuses fin_statements(from,to) |
| Drill-down from summary to source transaction | BUILT (0134 fin_gl_detail + Trial-Balance click-through on /dashboard/finance/statements) |
| Scheduled / automated report delivery | NOT_STARTED (advanced Phase 6) |
| Export (PDF, Excel, CSV) | BUILT (CSV built + formula-injection hardened (csvSafe). PDF via the browser's own print pipeline + a print stylesheet — deliberately NOT a server-rendered PDF: no headless browser on serverless, and a PDF library would re-implement the layout a SECOND time, giving the same figures two renderings and two places to disagree. The print CSS preserves the 'statement is incomplete' warning colours — printing it as invisible grey would produce a clean-looking statement over an unexplained gap, in a file someone forwards to a bank. EXCEL: CSV opens in Excel and that is what ships; a true .xlsx needs a new dependency — FLAGGED for founder decision, not silently added or silently skipped) |

## PHASE 7 — Tax & Compliance
| Feature | Status |
|---|---|
| Tax code configuration (VAT/GST/sales tax by jurisdiction) | BUILT (0150 fin_tax_codes — rate × jurisdiction × direction; /dashboard/finance/tax) |
| Tax calculation on transactions | BUILT — tax posts to 2100/1200; bill/invoice line editors have a tax-code picker (input codes on bills, output on invoices) that auto-computes tax_amount = amount × rate (overridable). tax_code_id stored on the line for jurisdiction reporting |
| Tax liability tracking | BUILT (0150 fin_tax_report — output − input tax by jurisdiction/period from source lines; on /tax) |
| Tax filing reports | BUILT (fin_tax_report by period + jurisdiction; the filing figure) |
| Contractor / 1099 (or local equiv) reporting | BUILT (0170 fin_vendors.is_1099/tax_classification + fin_1099_payments + fin_1099_worksheet + fin_1099_readiness; API /api/finance/contractors + UI /dashboard/finance/contractors). THE RULE: a 1099 reports CASH ACTUALLY PAID in the CALENDAR year, never bills accrued — our ledger is accrual-based, so a bill dated 20-Dec paid 5-Jan is a December expense and a January payment, and belongs on NEXT year's form. Summing bills instead would be wrong every January in a way that balances, ties to the GL, and MATCHES THE P&L EXACTLY — nothing internal would catch it; the contractor would, holding a bank statement that disagrees. This is the only figure in the system a THIRD PARTY audits us against. Amount is taken from the ledger's server-computed base_credit on the cash line (not fin_payments.amount, which is denominated in its own currency — summing USD+EUR would print a meaningless total on a tax form); only POSTED payments count; eligibility is DECLARED, never inferred; sub-threshold contractors stay VISIBLE so a filer can spot someone missing; fin_1099_readiness returns BLOCKERS in words (a missing TIN discovered in January, when the contractor has moved on, is how this really fails). No new table — a LENS on existing data, not a second copy that would drift. Acceptance tests/0170 — awaiting live-DB run to reach TESTED |
| Year-end close process | BUILT (0151 fin_close_year: posts closing entries revenue/expense → Retained Earnings 3000 [the account fin_init_company seeds] + locks the year; fin_reopen_year reverses + unlocks. Also fixes the ranged-BS caveat. Acceptance: tests/0150-0151) |

## PHASE 8 — Payroll & Assets
**Payroll** *(integration likely preferred — recommend at build time)*
| Feature | Status |
|---|---|
| Payroll expense posting to ledger | BUILT (0167 fin_payroll_runs + fin_post_payroll_run. INTEGRATED, not rebuilt (founder decision): the provider computes gross-to-net, we record and post. Dr 6000 Salary Expense (gross) + Dr 6100 Employer Tax Expense / Cr 2300 Net Pay Payable + Cr 2400 Withholdings Payable + Cr 2500 Employer Tax Payable, via fin_post_system_entry. Row-locked + unique(provider, external_id) so a re-fired webhook cannot post a second month of salary — which would balance perfectly. API /api/finance/payroll + UI /dashboard/finance/payroll. Acceptance tests/0167 — awaiting live-DB run to reach TESTED) |
| Employee compensation tracking | BUILT (0167 fin_payroll_runs holds each pay period as the provider computed it — gross, net, withholdings, employer tax, benefits, headcount, cost centre — with the identity gross = net + withholdings enforced as a CHECK. The API REFUSES to derive a missing figure: a mismatch means a column was misread on import, and filling it in would post a balanced, WRONG entry nothing downstream would catch. Per-employee detail stays with the provider by design. Acceptance tests/0167 — awaiting live-DB run to reach TESTED) |
| Benefits and employer contributions | BUILT (0167: employer tax + employer-paid benefits post ON TOP of gross to 6100/2500, never inside it. Folding them into gross still balances and still ties out — but makes the true cost of an employee indistinguishable from their salary, silently corrupting every unit-economics and cost-per-project figure downstream, in the direction that flatters the business. Asserted in tests/0167 (B) — awaiting live-DB run to reach TESTED) |
| Payroll tax liabilities | BUILT (0167: withholdings owed on the employee's behalf land in 2400 Withholdings Payable; the company's own contribution lands in 2500 Employer Tax Payable — two distinct liabilities, because they are owed for different reasons and settled separately. Both are real balances on the Balance Sheet until paid. Acceptance tests/0167 — awaiting live-DB run to reach TESTED) |

**Assets**
| Feature | Status |
|---|---|
| Fixed asset register | BUILT (0166 fin_fixed_assets + fin_asset_register view; cost, salvage, useful life, NBV and REMAINING DEPRECIABLE BASE — NBV alone cannot distinguish 'at salvage, must stop' from 'years left', and that difference decides whether the next run is correct or a false asset valuation. API /api/finance/assets + UI /dashboard/finance/assets. Acceptance tests/0166 — awaiting live-DB run to reach TESTED) |
| Depreciation schedules with automated entries | BUILT (0166 fin_run_depreciation: straight-line, Dr 6500 Depreciation Expense / Cr 1900 Accumulated Depreciation, posted via fin_post_system_entry so it inherits the open-period gate and balance assertion. TWO GUARDS, both against failures that BALANCE PERFECTLY: (1) the final slice is CLAMPED to the remaining depreciable base, so net book value can never fall below salvage — a full final slice overshoots and claims the asset is worth less than scrap, and the error is invisible until the asset's LAST month; (2) (asset_id, period_id) is UNIQUE and the RPC returns the existing entry rather than posting again, so a retried monthly job cannot double-post the expense. Posted slices are append-only. API /api/finance/assets + UI /dashboard/finance/assets. Acceptance tests/0166 — awaiting live-DB run to reach TESTED) |
| Asset disposal handling | BUILT (0166 fin_dispose_asset: posts ALL FOUR legs — Dr Cash (proceeds) + Dr Accumulated Depreciation / Cr Fixed Asset (at cost) + Cr/Dr Gain-or-Loss. Omitting the accumulated-depreciation reversal is the classic error: the entry still balances and leaves a phantom contra-asset on the balance sheet forever. Acceptance tests/0166 — awaiting live-DB run to reach TESTED) |
| Inventory management & valuation (if applicable) | NOT_STARTED |

## PHASE 9 — Platform & Governance
| Feature | Status |
|---|---|
| Role-based access control (accountant, controller, CFO, approver, viewer) | BUILT (0116 fin_roles 5-role dimension + isAdminRole-style capability helpers + platform admin/CEO/COO→CFO bridge) |
| Segregation of duties (enter ≠ approve) | BUILT (enforced in fin_post_entry, fin_approve_bill [0130], fin_approve_expense_report — creator/employee ≠ approver at the DB level) |
| Approval workflows and delegation | BUILT (0168 fin_approval_delegations — a controller lends approval authority for a fixed window instead of lending their login, which is what actually happens today and makes every approval in that window a lie the ledger records perfectly. THE WRITE GATE IS THE FEATURE (§A23): RLS INSERT requires delegator_id = auth.uid(), so a member cannot mint "the CFO delegates to me"; a CHECK forbids self-delegation; the RPC requires the delegator to actually HOLD authority (else two viewers delegate to each other and manufacture an approver from nothing); fin_approval_limit_for caps borrowed authority at the LENDER's ceiling; there is no UPDATE path, so a lapsed window cannot be silently extended. fin_can_approve() re-checks the delegator's role AT USE TIME — a delegation is a pointer to someone's authority, never a snapshot, so demoting a compromised controller kills the borrowed authority with it. Segregation of duties is NOT delegated: the SoD checks compare against auth.uid() = the delegate, so a stand-in still cannot approve what they entered. API /api/finance/delegations (accepts NO delegator field — the absence is the security model) + UI on /dashboard/finance/controls. Acceptance tests/0168 is written as SIX ATTACKS that must all fail, not as arithmetic — this is the one feature whose failure mode is not a wrong number but a wrong PERSON holding authority with an audit trail that endorses them. Awaiting live-DB run to reach TESTED) |
| Multi-entity support and consolidation | NOT_STARTED |
| Data import / export and migration tools | BUILT — opening-balance import (0169 fin_opening_batches/lines + fin_post_opening_batch + fin_opening_summary/imbalance views + API + /dashboard/finance/opening-balances + src/lib/finance/trialBalance.ts, 12 unit tests). Without this the ledger serves only a company founded the day it installed us. THE RULE: a trial balance from a real old system OFTEN DOES NOT BALANCE, and that gap is the most valuable fact in the import — so the contra posts to Opening Balance Equity (3900) where the residual STAYS VISIBLE, and is never plugged into an existing equity account. A plug would balance, tie out, and pass every downstream check forever while the company ran on a fabricated position. The failure mode here is a green screen, not an error. Staged-before-posted (the user sees the gap BEFORE committing); row-locked post (a double-post would double every balance and still balance); refuses to post under a ledger already in use; configure-level; staging record freezes once posted. Acceptance tests/0169 imports a DELIBERATELY imbalanced trial balance and asserts the system tells the truth — THE FAILING CONDITION IS A ZERO. Export = CSV via csvSafe (formula-injection hardened); .xlsx FLAGGED (new dependency, founder's call). Awaiting live-DB run to reach TESTED |
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
**Phase 7** — BUILT (0150 tax codes/calc/liability/filing report + 0151 year-end close→RE 3000 + 0170
contractor/1099 on a CASH basis). Phase 7 is now complete.
**Phase 8** — BUILT (0166 fixed-asset register + depreciation with a salvage clamp and one run per
asset per period; 0167 payroll as a LEDGER-SIDE integration — we record what the provider computed and
refuse to derive a missing figure, because gross = net + withholdings is an identity, and a mismatch is a
misread column, not a gap to fill).
**Phase 9** — RBAC, SoD, encryption, backup (Supabase) BUILT; approval-delegation BUILT (0168);
opening-balance import BUILT (0169); multi-entity + full
integration-layer deferred.
Everything Phase-2+ is verified-by-construction; hardened this session across EIGHT audit angles (money-
logic, API routes, UI load-errors, UI mutation-errors, cross-migration account codes, view isolation,
table RLS, DEFINER tenant-safety) with 7 defects fixed — see docs/closures/2026-07-11-financial-system-session.md. One open
FINANCE decision: tax-report credit-note netting (TAX-CREDIT-NOTE-NETTING-DECISION.md). Apply 0122–0151 to
a live DB + run the acceptance scripts / VERIFICATION-RUNBOOK-FULL.md (Steps 1–15) to reach TESTED.*
