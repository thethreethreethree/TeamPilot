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
| Double-entry general ledger — balanced debits/credits every transaction | NOT_STARTED (Increment 3) |
| Journal entries — manual + automated, with approval workflow | NOT_STARTED (Increment 3) |
| Fiscal periods — open/close; closed periods locked | BUILT (0117; table + non-overlap + close/reopen/lock RPCs. The closed-period IMMUTABILITY trigger on entries ships with the ledger, Increment 3. Acceptance: tests/0117_periods.test.sql — awaiting live-DB run) |
| Multi-currency support — exchange rates, FX gain/loss | NOT_STARTED (Increment 4) |
| Immutable audit trail — append-only who/what/when/prior-value | NOT_STARTED (Increment 5) |

*Increment 1 (0116) also laid the foundation for Phase 9's RBAC + SoD: `fin_settings` (base
currency), `fin_roles` (the 5-role finance dimension), and the `fin_effective_role()` /
`fin_can_*` capability helpers with the platform-role→CFO bridge. Those Phase-9 rows stay
NOT_STARTED until their full scope (delegation, etc.) is built, but the authority spine is in.*

## PHASE 2 — Transactions
**Accounts Payable**
| Feature | Status |
|---|---|
| Vendor / supplier master records | NOT_STARTED |
| Purchase orders | NOT_STARTED |
| Bill / invoice capture and entry (file ingestion / OCR) | NOT_STARTED |
| Payment scheduling and execution | NOT_STARTED |
| Recurring expenses (rent, subscriptions, utilities) | NOT_STARTED |
| Approval workflows with role-based spend limits | NOT_STARTED |

**Accounts Receivable**
| Feature | Status |
|---|---|
| Customer master records | NOT_STARTED |
| Invoice generation and delivery | NOT_STARTED |
| Payment tracking and application | NOT_STARTED |
| Aging reports (30/60/90) | NOT_STARTED |
| Dunning / collections workflow | NOT_STARTED |
| Credit notes and refunds | NOT_STARTED |

**Expense Management**
| Feature | Status |
|---|---|
| Employee expense submission (receipt capture) | NOT_STARTED |
| Expense categorization | NOT_STARTED |
| Reimbursement workflow and approvals | NOT_STARTED |
| Corporate card transaction reconciliation | NOT_STARTED |
| Mileage / per-diem handling | NOT_STARTED |
| Policy enforcement (limits, disallowed categories) | NOT_STARTED |

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
**Core financial statements**
| Feature | Status |
|---|---|
| Profit & Loss (Income Statement) | NOT_STARTED |
| Balance Sheet | NOT_STARTED |
| Cash Flow Statement | NOT_STARTED |
| Trial Balance | NOT_STARTED |
| General Ledger detail report | NOT_STARTED |

**Management reporting**
| Feature | Status |
|---|---|
| Custom report builder | NOT_STARTED |
| KPI dashboard (revenue, burn, margin, runway, DSO, etc.) | NOT_STARTED |
| Period-over-period comparison | NOT_STARTED |
| Drill-down from summary to source transaction | NOT_STARTED |
| Scheduled / automated report delivery | NOT_STARTED |
| Export (PDF, Excel, CSV) | NOT_STARTED |

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
| Role-based access control (accountant, controller, CFO, approver, viewer) | NOT_STARTED |
| Segregation of duties (enter ≠ approve) | NOT_STARTED |
| Approval workflows and delegation | NOT_STARTED |
| Multi-entity support and consolidation | NOT_STARTED |
| Data import / export and migration tools | NOT_STARTED |
| Integration layer (bank feeds, Stripe, CRM, payroll, external accounting) | NOT_STARTED |
| Encryption at rest and in transit | NOT_STARTED |
| Backup and recovery | NOT_STARTED |

---

*Updated at each phase boundary per section 2.2. Current phase: **PHASE 1 — data model proposed,
awaiting founder confirmation before implementation code.***
