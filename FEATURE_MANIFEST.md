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
| Payment scheduling and execution | PARTIAL (0124 fin_payments + fin_pay_bill: Dr AP/Cr Cash, partial payments, over-pay guard, marks bill paid). FLAGGED: foreign-currency FX-on-payment deferred (rejected, not mis-posted); payment SCHEDULING + actual execution = processor/bank integration |
| Recurring expenses (rent, subscriptions, utilities) | BUILT (0140 fin_recurring_bills template + generate + batch runner; API + /dashboard/finance/recurring. Auto-generation needs cron wiring) |
| Approval workflows with role-based spend limits | PARTIAL — bill approval built (fin_approve_bill, approve-capability gated); FLAGGED: role-based spend-LIMIT thresholds need your $ values |

**Accounts Receivable**  *(Option B finance-native; 0131 core + 0132 receipts + API/UI)*
| Feature | Status |
|---|---|
| Customer master records | BUILT (fin_customers + API/UI) |
| Invoice generation and delivery | BUILT — generation (fin_invoices + fin_issue_invoice→GL, SoD issuer≠creator). Delivery (email/PDF) FLAGGED follow-up |
| Payment tracking and application | BUILT (fin_receipts + fin_record_receipt→GL; partial + over-receipt guard + row lock) |
| Aging reports (30/60/90) | BUILT (0133 fin_ar_aging view + summary RPC + AR-page buckets panel) |
| Dunning / collections workflow | PARTIAL — collections worklist (overdue invoices) built (/api/finance/ar/collections + AR-page section); automated email reminders = integration follow-up |
| Credit notes and refunds | NOT_STARTED (2D) |

**Expense Management**  *(0125)*
| Feature | Status |
|---|---|
| Employee expense submission (receipt capture) | BUILT (fin_expense_reports + fin_expense_items, receipt_url field; submission open to any company member — FLAGGED access-model decision) |
| Expense categorization | BUILT (category field per item) |
| Reimbursement workflow and approvals | BUILT (fin_approve_expense_report→GL with employee≠approver SoD; fin_reimburse_expense_report→GL) |
| Corporate card transaction reconciliation | NOT_STARTED (Increment 2D) |
| Mileage / per-diem handling | NOT_STARTED (Increment 2D) |
| Policy enforcement (limits, disallowed categories) | NOT_STARTED (Increment 2D) |

## PHASE 3 — Banking & Reconciliation
| Feature | Status |
|---|---|
| Bank account management (multiple accounts) | NOT_STARTED |
| Bank feed integration (Plaid or equiv) **or** statement import | NOT_STARTED |
| Automated transaction matching to ledger | NOT_STARTED |
| Manual reconciliation interface for unmatched items | NOT_STARTED |
| Real-time cash position dashboard | NOT_STARTED |

## PHASE 4 — Cost, Profitability & Waste
**Cost tracking**
| Feature | Status |
|---|---|
| Cost centers / departments | NOT_STARTED |
| Project & job costing | NOT_STARTED |
| Direct vs. indirect cost classification | NOT_STARTED |
| Cost of Goods Sold (COGS) tracking | NOT_STARTED |
| Overhead allocation rules | NOT_STARTED |

**Profitability analysis**
| Feature | Status |
|---|---|
| Gross margin — by product/service/client/project/region | NOT_STARTED |
| Net profitability by segment | NOT_STARTED |
| Contribution margin analysis | NOT_STARTED |
| Unit economics (cost per unit/customer/transaction) | NOT_STARTED |
| Customer profitability | NOT_STARTED |
| Break-even analysis | NOT_STARTED |

**Waste & efficiency**
| Feature | Status |
|---|---|
| Budget vs. actual variance analysis | NOT_STARTED |
| Unused / underutilized resource tracking | NOT_STARTED |
| Spend anomaly detection | NOT_STARTED |
| Duplicate payment detection | NOT_STARTED |
| Cost-per-outcome metrics | NOT_STARTED |
| Inventory waste / shrinkage (if applicable) | NOT_STARTED |

## PHASE 5 — Budgeting & Forecasting
| Feature | Status |
|---|---|
| Budget creation (annual/quarterly, by dept & cost center) | NOT_STARTED |
| Budget vs. actual tracking with variance alerts | NOT_STARTED |
| Rolling forecasts | NOT_STARTED |
| Cash flow forecasting / projection | NOT_STARTED |
| Scenario modeling | NOT_STARTED |
| Runway calculation | NOT_STARTED |

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
| Period-over-period comparison | NOT_STARTED (needs date-ranged statements — derivable, no new data model) |
| Drill-down from summary to source transaction | BUILT (0134 fin_gl_detail + Trial-Balance click-through on /dashboard/finance/statements) |
| Scheduled / automated report delivery | NOT_STARTED (advanced Phase 6) |
| Export (PDF, Excel, CSV) | PARTIAL — CSV built (opens in Excel); PDF/native-xlsx later |

## PHASE 7 — Tax & Compliance
| Feature | Status |
|---|---|
| Tax code configuration (VAT/GST/sales tax by jurisdiction) | NOT_STARTED |
| Tax calculation on transactions | NOT_STARTED |
| Tax liability tracking | NOT_STARTED |
| Tax filing reports | NOT_STARTED |
| Contractor / 1099 (or local equiv) reporting | NOT_STARTED |
| Year-end close process | NOT_STARTED |

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

*Updated as built per section 2.2. **State at 2026-07-12 (migrations 0116–0134):**
**Phase 1** — BUILT + founder-VERIFIED (acceptance scripts PASS).
**Phase 2** core — AP + AR + Expenses BUILT + operational (backend + API + UIs); enrichments (POs,
recurring, dunning, credit notes, card-recon, mileage, policy) NOT_STARTED / need values.
**Phase 6** core — P&L, Balance Sheet, Trial Balance, GL drill-down, CSV export BUILT (derived);
Cash Flow + custom builder + scheduling + PDF/xlsx NOT_STARTED.
**Phase 9** — RBAC, SoD, encryption BUILT; approval-delegation, multi-entity, backup/recovery, full
integration-layer NOT_STARTED.
**Phase 3** — data-model PROPOSED (docs/financial-system/PHASE-3-DATA-MODEL.md), awaiting confirmation.
**Phases 4, 5, 7, 8** — NOT_STARTED (each needs a data-model proposal + confirmation).
Everything Phase-2+ is verified-by-construction + authz-audited clean; apply 0122–0134 to a live DB
+ run the acceptance scripts / the full-system runbook to reach TESTED.*
