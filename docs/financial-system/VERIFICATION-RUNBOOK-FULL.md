# Full-system verification runbook — Financial System (Phase 1 + Phase 2 + Phase-2D + statements)

The one page to confirm the whole system works end-to-end on your DB. Phase 1's DB-level invariants
already passed (0116_foundation…0120_audit acceptance scripts). This verifies the Phase-2 + reporting
+ Phase-2D layer the way a real user drives it. ~15 minutes.

Steps 1–5 are the core double-entry proof (AP → AR → statements). Steps 6–8 exercise the Phase-2D
enrichments (Expenses, Purchase Orders, Recurring bills). Aging + collections are checked inline.

## Step 1 — apply migrations
> **Prerequisite: Postgres 15+.** The migrations use `security_invoker` views and `NULLS NOT DISTINCT`
> (0149) — both PG15+. Supabase provides this by default, and your DB is already confirmed 15+ (you
> applied `0121`, a `security_invoker` view, which would fail on PG14). No PG16-only features are used,
> so 15 is the floor. Only relevant if you ever apply to a *fresh* / different database.

Apply **0122 → 0153** in numeric order (on a fresh DB, apply 0116 → 0153). Covers Phase 2, the audit
fixes, AR, statements + date-ranged statements, all Phase-2D features, credit notes (0143), the
security fixes (0141/0142), **Phase 3 Banking (0145)**, duplicate detection (0146), **Phase 4 cost/
profitability (0147/0148)**, **Phase 5 budgeting (0149)**, and **Phase 7 tax + year-end close
(0150/0151)**. *(As of 2026-07-13 the founder has applied through 0144; `0145`–`0153` are outstanding.)*
Two properties are verified so the apply is low-risk:
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

## Step 9 — Credit notes (0143 — reduce an issued invoice, contra-revenue)
1. **Finance → Credit Notes** → pick an **issued (sent)** invoice, enter a credit # + date + amount
   (less than the invoice's outstanding) → Create draft.
2. A **different** finance user **Issues** it (SoD) → posts **Dr Sales Returns 4900 / Cr AR**. Confirm
   the invoice's **outstanding drops** on the Receivable page + aging, and Books stay Balanced.
3. Try to issue a credit **larger** than the outstanding → rejected (over-credit guard).

## Step 10 — Date-ranged statements + period-over-period (0144)
1. **Finance → Statements** → the period selector: **All time / This month / This quarter / This
   year / Custom**. Pick "This month" → the **Income Statement** covers this month; the **Balance
   Sheet + Trial Balance** are **as of** the month end (a snapshot).
2. A **"Period over period"** card appears comparing this period's revenue/expenses/net income to the
   prior same-length window, with Δ and %.

## Step 11 — Banking & Reconciliation (0145 — Phase 3)
1. **Finance → Banking** → add a bank account, linking it to a **cash GL account** (e.g. 1000 Cash).
2. **Import CSV** — a statement with a header row (date, amount, description). Deposits are +, withdrawals −.
3. **Auto-match** → bank lines that equal a posted cash entry within **±3 days** flip to *matched*
   (a fin_reconciliation_match links them); the rest stay *unmatched* in the worklist. **Ignore**
   dismisses a non-ledger line. The account tile shows its GL cash balance + unmatched count.

## Step 12 — Duplicate-payment detection (0146)
On the **Payable** page, if two bills share the **same vendor + same total within 7 days**, a
**"Possible duplicate bills"** prompt lists the pair — review before approving/paying (a candidate,
not a verdict).

## Step 13 — Cost & Profitability (0147/0148 — Phase 4)
1. **Finance → Profit** → create a **cost center** (e.g. `ENG` Engineering) and a **project** (e.g.
   `P1` Acme rollout, optionally linked to a customer).
2. On **Receivable**, create an invoice; on each line the **Cost center / Project** pickers now appear —
   tag a revenue line to `P1`. On **Payable**, create a bill and tag an expense line to `P1`. Approve/
   issue both (second user, SoD).
3. Back on **Profit**: the **project** row shows revenue (from the invoice) − cost (from the bill) =
   margin, with margin %. Contribution margin uses accounts marked `cost_type = direct`. Customer
   profitability rolls the project up by its client link.

## Step 14 — Budgeting, variance & runway (0149 — Phase 5)
1. **Finance → Budget** → the **Runway** card shows cash ÷ 3-month avg burn (∞ if profitable).
2. Create a budget (name + year) → add a line: an **expense account**, a **cost center**, **Q1**, an
   amount. Post an actual expense dated in Q1 (via an approved bill tagged to that cost center).
3. The variance table shows **budget vs actual** for Q1; over-budget expense (or under-budget revenue)
   shows **red**. A Q2 actual won't affect the Q1 line (quarter-scoped).

## Step 15 — Tax & year-end close (0150/0151 — Phase 7)
1. **Finance → Tax** → add a tax code (e.g. `VAT20`, 20%, direction **Sales/output** for invoices; add
   a **Purchases/input** one for bills).
2. On **Receivable**, a new invoice line now has a **Tax code** picker — pick `VAT20` → tax auto-fills
   (amount × 20%, overridable). Issue the invoice. Same on **Payable** with an input code.
3. Back on **Tax** → the **liability report** (pick a date range) shows output − input tax by
   jurisdiction; net = what you owe/reclaim.
4. **Year-end close** → enter a year with posted P&L, **Close year** → confirm it posts closing entries
   (revenue/expense → Retained Earnings 3000) and **locks** the year's periods; the P&L zeros out for a
   fresh year. **Reopen** reverses it and unlocks.

## Step 16 — Concurrency locks (optional, but the only way to confirm the 0147/0152/0153 fixes)
The row-lock fixes prevent double-posting under **concurrent** action — which the single-session
acceptance scripts can't exercise. To confirm one by hand: open the same draft in **two browser tabs**
(or fire two API calls back-to-back) and trigger the action in both as fast as possible:
- **Approve the same draft bill** twice (two tabs) → exactly ONE posts; the second returns *"Only a
  draft bill can be approved"* (not two GL entries). Same for issue-invoice, approve-expense.
- **Reimburse the same report** twice → one cash-out; the second errors (no double payment).
- **Issue two credit notes** that each fit the outstanding but together exceed it, concurrently → the
  second hits the over-credit guard (no over-credit).
Before the locks these could both succeed under a race; after (0147/0152/0153) the second always blocks
then fails the status/over-credit check. If you ever see a double-post, that's the signal to apply the
`fin_source_postings` unique-index backstop (see FOUNDER-ACTION-QUEUE.md → Recommended hardening).

## What "pass" means
Every posted transaction moved the statements, the Trial Balance stayed **debits = credits**, and the
Balance Sheet **tied out** — i.e., the double-entry spine holds end-to-end through the subledgers to
the statements. Dimension tags flow to profitability; budget lines compare to the same posted actuals;
tax flows to the liability report; year-end close moves P&L into Retained Earnings. Verified on real data.

## Known limits (by design, flagged in the audit doc)
- Bill / invoice / **expense** entry are all **multi-line + per-line tax/category** (2026-07-13).
- Foreign-currency settlement is rejected (FX-on-payment is a later increment), base-currency works.
- Expense/AR issue + credit-note issue need a second finance user (SoD).
- Cash Flow Statement + PDF export not built. **Phases 3 (Banking), 4-inc1 (Cost/Profit), 5-inc1
  (Budget/variance/runway), 7 (Tax + year-end close) ARE built** (Steps 11, 13, 14, 15). Deferred:
  Phase-4 overhead/anomaly/inventory, Phase-5 forecasts/scenario, tax 1099. **Phase 9 mostly built**
  (RBAC/SoD/encryption/backup). **Phase 8 (payroll/assets)** proposed; Phase-9 gaps (delegation/multi-
  entity/integrations) proposed — each needs confirmation.

*If any step doesn't behave as above, tell me which step + what you saw and I diagnose from the
named behavior — the honest-error discipline, not a guess.*
