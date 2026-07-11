# Phase 2 — Data Model Proposal (Transactions: AR · AP · Expenses)

**Status: PROPOSAL — awaiting founder confirmation. No implementation code written**
(FinancialSystem.md section 2.2/section 6: propose + wait for confirmation before a phase's code). This is the
*what* and *why*; on your sign-off it becomes migrations + tests, in the increments below.

**The one principle that governs all of Phase 2:** every subsystem here is a **subledger** that
**posts to the Phase-1 GL** — it never invents a parallel ledger. A bill, invoice, or expense
becomes one or more balanced `fin_journal_entries`. The GL stays the single source of truth; AP/AR
balances **reconcile to their GL control accounts** (Accounts Payable / Accounts Receivable).

---

## DECISION 0 (headline, blocking) — reconcile AR with the EXISTING CRM

The app already has `crm_accounts` (customer master), `crm_invoices` (with `CrmInvoiceStatus`), and
`crm_subscriptions` (`src/lib/crm/`). The spec's Phase-2 AR asks for "customer master records" and
"invoice generation" — which **already exist in the CRM**. Building `fin_customers` + `fin_invoices`
alongside them would be the A21 "same concept, two modules" failure. Per A28 (check precedent before
inventing), this is **your decision, not mine to silently pick**:

- **Option A — Bridge (recommended):** the CRM stays the customer + invoice system of record;
  Finance adds an **accounting posting layer** — when a CRM invoice is *issued*, a GL entry posts
  (Dr Accounts Receivable, Cr Revenue [+ Tax Payable]); when payment is applied, (Dr Cash, Cr AR).
  AR aging/collections read from `crm_invoices` + the GL. **No duplicate customer/invoice tables.**
- **Option B — Separate finance AR:** `fin_customers` + `fin_invoices` independent of the CRM.
  Cleaner accounting boundary, but duplicates the customer master and the invoice concept (drift
  risk, two places to keep in sync).
- **Option C — Unify:** migrate `crm_invoices` to be the finance invoice (one table, both roles).
  Most correct long-term, biggest blast radius (touches the live CRM).

I recommend **A** (add accounting to what exists; don't duplicate). **Confirm A / B / C before I
design AR in detail** — the rest of the AR increment depends entirely on this.

(AP and Expenses have **no** existing-module overlap — vendors and employee expenses are new.)

---

## Accounts Payable (money out) — new tables, post to GL

- `fin_vendors` — supplier master (name, contact, tax id, terms, default expense account).
- `fin_bills` — vendor invoices (vendor, dates, currency, status draft→approved→paid) + bill lines
  (expense/asset account, amount, tax). **On approval → GL entry** (Dr expense/asset, Cr AP).
- `fin_payments` — money out against bills. **On execution → GL** (Dr AP, Cr Cash) + realized FX
  gain/loss if the payment rate differs from the bill rate (uses the Phase-1 FX Gain/Loss account).
- `fin_purchase_orders` (+ lines) — optional pre-bill commitment; no GL impact until billed.
- **Recurring expenses** — a template that generates bills on a schedule (rent, subscriptions).
- **Approval workflow + spend limits** — role-based thresholds on `fin_roles` (an approver can
  approve up to $X; above it escalates to controller/cfo).

## Expense Management (employee spend) — new tables, post to GL

- `fin_expense_reports` + `fin_expense_items` — submission (receipt attachment), categorization,
  reimbursement workflow. **On approval → GL** (Dr expense, Cr Employee Reimbursements Payable);
  **on reimbursement → GL** (Dr that payable, Cr Cash).
- Corporate-card reconciliation, mileage/per-diem, policy enforcement (limits, disallowed
  categories) layer on top.

## How a subledger posts to the GL (needs your confirmation — DECISION 1)

A bill/invoice/expense already carries its **own** approval. When it posts to the GL, that's a
**system** action, not a second human approval. So I propose a `fin_post_system_entry(...)`
SECURITY DEFINER path that posts a balanced entry with `source='ap'|'ar'|'expense'` **without** the
interactive human-to-human SoD check (the SoD that mattered happened on the bill/invoice approval).
Confirm that's the intended treatment, or say subledger postings must also carry a second GL approver.

## Tax (DECISION 2)

Bills/invoices have tax lines. Full tax-code configuration is **Phase 7**. I propose Phase 2 **captures**
tax as an amount to a "Tax Payable"/"Tax Receivable" account (so the GL is correct), and Phase 7 adds
jurisdiction/rate configuration + filing. Confirm: capture-only now, full config in Phase 7.

## Build-vs-buy flags (section 2.1 — I recommend integrations here)

- **OCR bill/receipt capture** — recommend a document-AI integration, not building OCR.
- **Payment execution** (actually moving money) — recommend a processor/bank integration
  (Stripe/ACH); the ledger records the payment, the rails are external.
- **Bank feeds** are Phase 3. AP/AR *reconcile* to bank data there.

## Proposed increment sequence (each ends BUILT then TESTED before the next)

- **2A — AR posting layer** (after Decision 0): issue-invoice → GL, apply-receipt → GL, aging view.
- **2B — AP core:** vendors, bills → GL, payments → GL (+ FX gain/loss).
- **2C — Expense management:** reports/items → GL, reimbursement → GL.
- **2D — Enrichments:** POs, recurring, dunning/collections, credit notes/refunds, card recon,
  mileage/per-diem, policy, spend-limit approvals.

## What I need to start Phase 2 (blocking)

1. **Decision 0** — AR vs the CRM: **A / B / C** (I recommend A).
2. **Decision 1** — subledger→GL posting: system-post (no second SoD) vs second GL approver.
3. **Decision 2** — tax: capture-only now, full config Phase 7 (confirm).
4. **Phase-1 verification** — have the 6 acceptance scripts been run and do they PASS? Phase 2
   posts to the Phase-1 GL, so it must be trustworthy first (section 2.2).

On your answers I build 2A first (proposal → your sign-off → migration + tests), then 2B, 2C, 2D.
