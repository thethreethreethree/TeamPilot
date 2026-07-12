# Full-system verification runbook — Financial System (Phase 1 + Phase 2 + statements)

The one page to confirm the whole system works end-to-end on your DB. Phase 1's DB-level invariants
already passed (0116_foundation…0120_audit acceptance scripts). This verifies the Phase-2 + reporting
layer the way a real user drives it. ~10 minutes.

## Step 1 — apply migrations
Apply **0122 → 0134** (you confirmed through 0121). They're idempotent and ordered; the chain was
audited for dependency order (every object defined before its consumers).

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

## Step 4 — AR
1. **Finance → Accounts Receivable** → add customer "Beta".
2. New invoice: Beta, "AR-1", today, revenue account **4000 Revenue**, amount **250** → Create.
3. A different finance user clicks **Issue** → posts Dr 1100 (AR) / Cr 4000 (Revenue).
4. Dashboard: **Revenue 250**; AR shows in Assets; **aging** on the AR page shows 250 outstanding.
5. **Receive 250** → Dr 1000 / Cr 1100; invoice → Paid; AR clears.

## Step 5 — Statements (the readout)
1. **Finance → Financial Statements.**
2. **Income Statement:** Revenue 250 − Expenses 100 = **Net income 150**.
3. **Balance Sheet:** Assets = Liabilities + Equity + Net income → the green **Balances** check.
4. **Trial Balance:** total debits = total credits (green check). Click any account → its posted
   transactions drill down.
5. **Export CSV** downloads all three statements.

## What "pass" means
Every posted transaction moved the statements, the Trial Balance stayed **debits = credits**, and the
Balance Sheet **tied out** — i.e., the double-entry spine holds end-to-end through the subledgers to
the statements. That's the whole system verified on real data.

## Known limits (by design, flagged in the audit doc)
- Bill/invoice UIs are single-line, no-tax (the API + RPCs support multi-line + tax).
- Foreign-currency settlement is rejected (FX-on-payment is a later increment), base-currency works.
- Expense/AR issue need a second finance user (SoD). Cash Flow, PDF export, and Phases 3/5/7/8/9 are
  not built (each new phase needs a data-model proposal).

*If any step doesn't behave as above, tell me which step + what you saw and I diagnose from the
named behavior — the honest-error discipline, not a guess.*
