# FinancialSystem.md

**Build Specification — Financial Tracking & Management System**
Platform: Elostate SaaS
Audience: Claude Code agent (VS Code)
Governing constitution: `thinkerthinker.md`

---

## 0. Purpose

Build a complete **Financial Tracking & Management System** used by the accounting/finance
department to track all financial matters of the company: expenses, revenue, profitability,
waste, budgets, forecasts, tax, assets, and reporting.

This document is the authoritative feature list and build protocol. Every feature listed here
must reach a terminal state (`BUILT` or `FLAGGED` with my approval). Nothing may be silently
omitted.

---

## 1. Governing Principles

This build follows `thinkerthinker.md`:

- **Understand before building.** Diagnose the requirement before writing code.
- **Explain the WHY.** Every non-trivial decision carries its reasoning.
- **No confident guessing.** In a financial system, a guess becomes a wrong number that
  someone acts on. Ask instead.
- **No error loops.** If an approach fails twice, STOP and re-diagnose. A repeated failure
  means the *identification* was wrong, not the implementation. Do not retry variants.
- **Correctness over speed.** A financial system that is "probably right" is useless.

---

## 2. How We Work Together

This system is large. We build it **in phases** — by design, not as a limitation. You are not
expected to build it all in one pass. Take the time you need.

### 2.1 On Refusing or Flagging Work — the distinction matters

**You SHOULD refuse or push back when there is a legitimate reason.** This is welcome and
expected. Valid grounds include:

- The approach would break the system, corrupt the ledger, or violate a correctness constraint
- It creates a security, data-integrity, or architectural problem
- It contradicts another requirement given to you
- A better approach exists (including **integrating an existing service** instead of building
  from scratch)
- The requirement is ambiguous and guessing would be dangerous

When you refuse or push back: **state the concern, give your reasoning, propose the
alternative.** I want your judgment. A well-reasoned objection is more valuable than compliance.

**You may NOT silently skip, omit, stub, or fake a feature because the scope is large or the
task is difficult.**

Every feature must end in exactly one of two states:
1. **Genuinely built**, or
2. **Explicitly flagged** to me with a stated reason, and my decision recorded.

A feature quietly not built, or a placeholder/stub presented as working, is unacceptable. In a
financial system, **fake completeness is the most dangerous possible failure** — it produces
confidently wrong numbers.

If the task feels too large to hold at once, **say so, and we will break it down further.**
Asking for smaller scope is always allowed and is never a failure. Scope pressure is never a
reason to cut corners silently; it is a reason to ask me to reduce scope.

### 2.2 Ground Rules

1. **Nothing gets silently dropped.** Maintain `FEATURE_MANIFEST.md` in the repo listing every
   feature in this document with a status:
   `NOT_STARTED` · `IN_PROGRESS` · `BUILT` · `TESTED` · `FLAGGED (reason)`
   Update it as you go. Report manifest state at the end of every phase.
2. **Build in the given sequence.** Later phases depend on earlier ones. Never build analytics
   on a ledger that isn't trustworthy yet.
3. **Confirm architecture before implementing.** At the start of each phase: propose the data
   model and structure, explain your reasoning, and **wait for confirmation** before writing
   implementation code.
4. **Ask when unclear.** Guessing is the primary failure mode here. Asking is always correct.
5. **Recommend integration where it's better.** For payroll, bank feeds, tax filing, and similar
   commodity components, flag it if an existing service beats building from scratch. I decide.

---

## 3. Non-Negotiable Correctness Requirements

These apply to the entire system and override convenience:

- **The ledger must always balance.** Enforce at the **database level**, not only in
  application code.
- **Never use floating point for money.** Use exact decimal arithmetic throughout.
- **Every derived figure must be traceable** to its source transactions (full drill-down).
- **Closed periods are immutable.**
- **All financial records are append-only.** Corrections are made via new entries (reversals /
  adjusting entries) — never by editing history.
- **Write tests for every calculation.** No calculation ships untested.
- **Encrypt at rest and in transit.** Financial data is highly sensitive.

---

## 4. Feature Set

> Every item below must reach `BUILT` (or `FLAGGED` with my explicit approval).
> Build phases in order.

### PHASE 1 — Foundation
*Everything depends on this. Build first.*

- [ ] **Chart of Accounts (COA)** — configurable account tree: Assets, Liabilities, Equity,
      Revenue, Expenses, with sub-accounts
- [ ] **Double-entry general ledger** — balanced debits/credits on every transaction
- [ ] **Journal entries** — manual and automated, with approval workflow
- [ ] **Fiscal periods** — period open/close; closed periods locked against edits
- [ ] **Multi-currency support** — exchange rates, FX gain/loss handling
- [ ] **Immutable audit trail** — append-only: who changed what, when, and the prior value

### PHASE 2 — Transactions

**Accounts Payable (money out)**
- [ ] Vendor / supplier master records
- [ ] Purchase orders
- [ ] Bill / invoice capture and entry (file ingestion / OCR)
- [ ] Payment scheduling and execution
- [ ] Recurring expenses (rent, subscriptions, utilities)
- [ ] Approval workflows with role-based spend limits

**Accounts Receivable (money in)**
- [ ] Customer master records
- [ ] Invoice generation and delivery
- [ ] Payment tracking and application
- [ ] Aging reports (30 / 60 / 90 day)
- [ ] Dunning / collections workflow
- [ ] Credit notes and refunds

**Expense Management**
- [ ] Employee expense submission (receipt capture)
- [ ] Expense categorization
- [ ] Reimbursement workflow and approvals
- [ ] Corporate card transaction reconciliation
- [ ] Mileage / per-diem handling
- [ ] Policy enforcement (limits, disallowed categories)

### PHASE 3 — Banking & Reconciliation

- [ ] Bank account management (multiple accounts)
- [ ] Bank feed integration (Plaid or equivalent) **or** statement import
- [ ] Automated transaction matching to ledger entries
- [ ] Manual reconciliation interface for unmatched items
- [ ] Real-time cash position dashboard

### PHASE 4 — Cost, Profitability & Waste
*This is the analytical core of the system.*

**Cost tracking**
- [ ] Cost centers / departments
- [ ] Project & job costing (allocate costs to projects/clients)
- [ ] Direct vs. indirect cost classification
- [ ] Cost of Goods Sold (COGS) tracking
- [ ] Overhead allocation rules

**Profitability analysis**
- [ ] Gross margin — by product, service, client, project, region
- [ ] Net profitability by segment
- [ ] Contribution margin analysis
- [ ] Unit economics (cost per unit / customer / transaction)
- [ ] Customer profitability (which clients actually make money)
- [ ] Break-even analysis

**Waste & efficiency**
- [ ] Budget vs. actual variance analysis
- [ ] Unused / underutilized resource tracking (idle capacity, unused licenses & subscriptions)
- [ ] Spend anomaly detection
- [ ] Duplicate payment detection
- [ ] Cost-per-outcome metrics (spend that produced nothing)
- [ ] Inventory waste / shrinkage (if applicable)

### PHASE 5 — Budgeting & Forecasting

- [ ] Budget creation (annual / quarterly, by department & cost center)
- [ ] Budget vs. actual tracking with variance alerts
- [ ] Rolling forecasts
- [ ] Cash flow forecasting / projection
- [ ] Scenario modeling (e.g. "what if revenue drops 20%")
- [ ] Runway calculation

### PHASE 6 — Reporting

**Core financial statements**
- [ ] Profit & Loss (Income Statement)
- [ ] Balance Sheet
- [ ] Cash Flow Statement
- [ ] Trial Balance
- [ ] General Ledger detail report

**Management reporting**
- [ ] Custom report builder
- [ ] KPI dashboard (revenue, burn, margin, runway, DSO, etc.)
- [ ] Period-over-period comparison
- [ ] Drill-down from summary figure to source transaction
- [ ] Scheduled / automated report delivery
- [ ] Export (PDF, Excel, CSV)

### PHASE 7 — Tax & Compliance

- [ ] Tax code configuration (VAT / GST / sales tax by jurisdiction)
- [ ] Tax calculation on transactions
- [ ] Tax liability tracking
- [ ] Tax filing reports
- [ ] Contractor / 1099 (or local equivalent) reporting
- [ ] Year-end close process

### PHASE 8 — Payroll & Assets

**Payroll** *(integration with an existing provider is acceptable and likely preferred —
recommend if so)*
- [ ] Payroll expense posting to ledger
- [ ] Employee compensation tracking
- [ ] Benefits and employer contributions
- [ ] Payroll tax liabilities

**Assets**
- [ ] Fixed asset register
- [ ] Depreciation schedules with automated depreciation entries
- [ ] Asset disposal handling
- [ ] Inventory management & valuation (if applicable)

### PHASE 9 — Platform & Governance
*Build alongside earlier phases where required.*

- [ ] Role-based access control (accountant, controller, CFO, approver, viewer)
- [ ] Segregation of duties (the person who enters ≠ the person who approves)
- [ ] Approval workflows and delegation
- [ ] Multi-entity support and consolidation
- [ ] Data import / export and migration tools
- [ ] Integration layer (bank feeds, Stripe / payment processors, CRM, payroll, external
      accounting software)
- [ ] Encryption at rest and in transit
- [ ] Backup and recovery

---

## 5. Tech Stack

```
[FILL IN — e.g. Next.js (App Router) / TypeScript / Supabase (Postgres) / Vercel]
```

---

## 6. Starting Instruction

**Begin with PHASE 1 only.**

1. Create `FEATURE_MANIFEST.md` listing every feature in Section 4, all marked `NOT_STARTED`.
2. Propose the **Chart of Accounts structure** and the **double-entry ledger data model**.
3. Explain your reasoning — the *why*, not just the *what*.
4. **Do not write implementation code until I confirm the data model.**

---

*Correctness over speed. Judgment welcome, silence is not. Nothing gets silently dropped.*
