# Full-system verification runbook — Financial System (Phase 1 + Phase 2 + Phase-2D + statements)

The one page to confirm the whole system works end-to-end on your DB. Phase 1's DB-level invariants
already passed (0116_foundation…0120_audit acceptance scripts). This verifies the Phase-2 + reporting
+ Phase-2D layer the way a real user drives it. ~15 minutes.

Steps 1–5 are the core double-entry proof (AP → AR → statements). Steps 6–8 exercise the Phase-2D
enrichments (Expenses, Purchase Orders, Recurring bills). Aging + collections are checked inline.

## Step 1 — apply migrations
Apply **0122 → 0140** (you confirmed through 0121) in numeric order. This one contiguous range covers
Phase 2, the audit fixes, AR, statements, and all Phase-2D features. Two properties were verified
2026-07-12 so the apply is low-risk:
- **Dependency order** — every object is defined before its consumers (no forward references).
- **Idempotent / re-runnable** — tables + indexes use `if not exists`; policies and triggers are
  `drop … if exists` before create; functions/views are `create or replace`; the three top-level
  backfills (Tax Receivable 1200, Employee Reimbursements Payable 2200, current-year period) are
  `where not exists`-guarded. So a re-run — or resuming a partially-applied chain — cannot throw an
  "already exists" / unique-violation error. If an apply is interrupted, just re-run the range.

## Step 2 — initialize + confirm the dashboard
1. Open **Finance**. If it shows "Your ledger isn't set up," click **Initialize finance (USD)**.
   → seeds the standard COA + a current-year open period (0126). Dashboard now shows real $0 figures
   and **Books: Balanced**.

## Step 3 — AP (solo-verifiable; no SoD on bills-by-one-person is now closed → you need the flow, see note)
> Note: after 0130, bill approval enforces creator≠approver. To verify AP **solo**, you'd need a second
> finance user to approve. If you're testing alone, either (a) grant a 2nd user a finance role and have
> them approve, or (b) read this as the intended SoD and verify AR-issue/expenses the same way.

1. **Finance → Accounts Payable** → add vendor "Acme".
2. New bill: Acme, "INV-1", today, account **6000 Operating Expenses**, amount **100** → Create.
3. A different finance user clicks **Approve** → posts Dr 6000 / Cr 2000.
4. Back on the dashboard: **Expenses 100**, **Accounts Payable** in Assets/Liabilities, **Books Balanced**.
5. **Pay 100** → Dr 2000 / Cr 1000; AP clears, Cash −100.
6. *(Before paying, glance at the **Payable** page's aging — the unpaid bill sits in a bucket by due
   date; after paying it clears. This is the fin_ap_aging view, 0138.)*

## Step 4 — AR
1. **Finance → Accounts Receivable** → add customer "Beta".
2. New invoice: Beta, "AR-1", today, revenue account **4000 Revenue**, amount **250** → Create.
3. A different finance user clicks **Issue** → posts Dr 1100 (AR) / Cr 4000 (Revenue).
4. Dashboard: **Revenue 250**; AR shows in Assets; **aging** on the AR page shows 250 outstanding.
5. **Receive 250** → Dr 1000 / Cr 1100; invoice → Paid; AR clears.
6. *(If an invoice's due date is past, it appears in the **Collections** worklist on the AR page,
   most-overdue first — the fin_ar_aging-derived dunning list. Receiving payment clears it.)*

## Step 5 — Statements (the readout)
1. **Finance → Financial Statements.**
2. **Income Statement:** Revenue 250 − Expenses 100 = **Net income 150**.
3. **Balance Sheet:** Assets = Liabilities + Equity + Net income → the green **Balances** check.
4. **Trial Balance:** total debits = total credits (green check). Click any account → its posted
   transactions drill down.
5. **Export CSV** downloads all three statements. *(The export is hardened against spreadsheet
   formula injection — an account named `=…` exports as literal text, not a live formula. See the
   csvSafe audit.)*

## Step 6 — Expenses (SoD: employee ≠ approver)
1. **Finance → Expenses** → **New report**, add an item (account **6000**, amount **50**) → submit.
2. A **different** finance user **Approves** → posts Dr 6000 / Cr a payable/accrual; report → approved.
   (Approving your own report is rejected — the SoD guard, 0125.)
3. **Reimburse** → posts the cash-out leg; report → reimbursed. Dashboard **Expenses** rises by 50.

## Step 7 — Purchase Orders (commitment → draft bill, no GL until billed)
1. **Finance → POs** → new PO for a vendor, one line (account **6000**, amount **80**) → Create (draft).
2. A **different** finance user **Approves** the PO (SoD, 0139) → status *approved*. **No ledger entry
   yet** — a PO is a commitment, not a transaction. Confirm the dashboard/statements did **not** move.
3. **Convert to bill** → creates a **draft** bill on the Payable page. From here it's the normal AP
   flow (approve → Dr 6000 / Cr 2000 → pay). The GL moves only at bill approval, not at PO time.

## Step 8 — Recurring bills (template → generated draft)
1. **Finance → Recurring** → new template (vendor, account **6000**, amount **30**, monthly) → Create.
2. **Generate now** → creates a **draft** bill dated the template's next date, and advances next_date
   by the frequency. Confirm a new draft appears on the Payable page; approving it posts to the GL
   like any bill. (The dormant fin_run_due_recurring batch runner does this for all due templates
   once a cron is wired — not required for this verification.)

## What "pass" means
Every posted transaction moved the statements, the Trial Balance stayed **debits = credits**, and the
Balance Sheet **tied out** — i.e., the double-entry spine holds end-to-end through the subledgers to
the statements. That's the whole system verified on real data.

## Known limits (by design, flagged in the audit doc)
- Bill/invoice UIs are now **multi-line + per-line tax** (2026-07-13) — add/remove lines, a running
  total; the expense-report UI remains single-item (a later polish).
- Foreign-currency settlement is rejected (FX-on-payment is a later increment), base-currency works.
- Expense/AR issue need a second finance user (SoD). Cash Flow, PDF export, and Phases 3/5/7/8/9 are
  not built (each new phase needs a data-model proposal).

*If any step doesn't behave as above, tell me which step + what you saw and I diagnose from the
named behavior — the honest-error discipline, not a guess.*
