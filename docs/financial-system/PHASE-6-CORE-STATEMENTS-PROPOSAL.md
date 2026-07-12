# Phase 6 (core) — Financial Statements proposal

**Status: PROPOSAL — awaiting confirmation (per-phase gate).** Scoped to the CORE statements, which
are pure readouts of the Phase-1 GL you've verified — no new state, all derived from the existing
`fin_account_balances` / `fin_trial_balance` views. The *advanced* Phase-6 items (custom report
builder, scheduled delivery, PDF/Excel export, period-over-period) are separate and proposed later.

## What I'd build (one increment, all derived)

1. **Trial Balance** — every account with its debit/credit balance; total debits = total credits.
   (The `fin_trial_balance` view already computes the totals; this lists the per-account detail.)
2. **Income Statement (P&L)** — Revenue − Expenses = Net Income, from `fin_account_balances` grouped
   by type. For a chosen date range (default: current period / year to date).
3. **Balance Sheet** — Assets = Liabilities + Equity, as of a date. Equity includes Retained
   Earnings + current-period Net Income (the accounting tie-out; I'll compute it so the sheet
   balances).
4. **General Ledger detail** — posted journal entries + lines for an account (drill-down from any
   balance to its source transactions — the "every figure traceable" non-negotiable, made visible).

**How:** an RPC (`fin_statements(as_of, from_date)`) that returns the grouped figures computed **in
SQL** (no JS money math), + a `/dashboard/finance/statements` page rendering the three statements
with drill-down, linked from the dashboard. CSV export of each is a small add; PDF/Excel I'd flag as
the advanced increment.

## Why it's low-risk / decision-independent
- Reads only Phase-1 data (the GL); needs none of Phases 3–5.
- No new tables, no writes — pure derivation, so nothing to corrupt.
- The one judgment call — how Net Income rolls into Balance-Sheet equity before year-end close — I'll
  implement the standard way (current-period net income as a line within equity) and note it.

## One confirmation
- **Proceed with the core statements now** (Trial Balance + P&L + Balance Sheet + GL detail, derived,
  read-only)? On "yes" I build the RPC + page + CSV export immediately. Advanced reporting (custom
  builder, scheduling, PDF/Excel, period comparison) stays a separate later proposal.

*This is the readout that makes the whole ledger legible — the point of double-entry. It rests
entirely on the foundation you've already verified.*
