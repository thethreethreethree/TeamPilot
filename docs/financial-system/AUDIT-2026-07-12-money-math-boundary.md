# Foundation audit — "never floating point for money; all money math in SQL"

**Date:** 2026-07-12 · **Layer (§1.7):** data/discipline · **Stance:** outside-view (§1.3)
**Trigger:** proactive audit (§1.5.2) of the financial system's #1 non-negotiable, after the CSV
formula-injection sweep (fd5abd7 / 429e496) showed the audit lens was finding real defects.

## The rule under audit

From FinancialSystem.md, the cardinal constraint: **ledger balances at the DB level; never
floating point for money (exact decimal); every figure traceable to source; all money math in SQL.**
Enforced structurally by `numeric(19,4)` columns and SQL-only derivation. This audit asks the
outside-view question: *does the JavaScript/TypeScript layer anywhere violate it in practice?*

## Method

Searched every finance TS/TSX file (`src/app/api/finance`, `src/app/dashboard/finance`,
`src/lib/finance`) for: arithmetic on money-named identifiers; `reduce` / `parseFloat` /
`Number(...) +` / `.toFixed` doing math; and — the real violation to hunt — any **write path that
computes a derived money value in JS and inserts it into the DB** (`quantity * unit_price`,
line-summing, computed totals before insert).

## Findings

**The rule holds end-to-end. No layer-N flag.** Every JS arithmetic hit falls into one of two
legitimate, non-authoritative buckets:

1. **Presentation only** — `money = n => $${(Number(n)||0).toFixed(2)}` (ap/ar/expenses/recurring
   pages) and the dashboard's `formatCompact` (÷1M/1K → "$1.2M"). These format an already-authoritative
   SQL value for a human; no result is stored or fed to further money math. `formatCompact` is a
   deliberately lossy abbreviation, correct for display.
2. **A tolerance-based tie-out badge** — `balanceSheetTiesOut` / `trialBalances`
   (`src/lib/finance/statements.ts`, mirrored in `statements/page.tsx`) add SQL-authoritative
   totals in JS and compare with a sub-cent (`< 0.005`) tolerance. This is a read-only
   defense-in-depth *check*, not the enforcement — the authoritative balance guarantee is the DB
   (fin_post_entry inline check + deferred balance triggers, 0118). The float error at these
   magnitudes is ~1e-10, nowhere near the 0.005 threshold. Unit-tested (statements.test.ts).

**Write paths verified clean (the empty-flag pressure-test, §1.7 rule 3):** every finance write
route passes the *user-provided* amount straight to SQL — `amount: l.amount`, `p_amount:
body.amount` — with Zod doing type/sign validation only (`z.number().nonnegative()/positive()`).
No route computes `quantity * price`, sums lines, or derives a total in JS before insert. Line
totals come from the SQL summary views (`fin_bill_summary`, `fin_invoice_summary`,
`fin_expense_report_summary`); GL debits/credits are computed entirely inside the SQL RPCs
(`fin_approve_bill`, `fin_pay_bill`, `fin_issue_invoice`, `fin_record_receipt`, expense approve).

## One honest edge (observation, not a defect)

Input amounts cross the HTTP/JSON boundary as JavaScript numbers (IEEE-754 doubles). A value like
`19.99` is really `19.9899999…` in float. This is **not** a live bug: the value is stored into a
`numeric(19,4)` column, and Postgres rounds the float's decimal expansion to 4 places (→ `19.9900`),
so the sub-picocent float error is absorbed far below cent precision, for every realistic money
magnitude (well under 2^53). The rule's spirit — *no accumulation of float error in stored/derived
values* — is not violated, because no JS **accumulation** occurs; only single-value transport.

The maximally-rigorous alternative, if the founder ever wants zero float representation anywhere in
the pipeline, is to transport amounts as **strings** and let Postgres parse the exact decimal. That
is a hardening refinement with real cost (client/validation churn), not a correction of a defect.
**Recommend: leave as-is unless a specific precision requirement (e.g. sub-cent instruments, FX at
6+ dp) emerges.** Flagged here so the choice is conscious, per §1.5.2.

## Verdict

The financial system's cardinal rule is **verified to hold at the application layer**, not merely
claimed. Authoritative money math is SQL-only; JS touches money only for display and for a
tolerance-guarded read-only tie-out check. This audit is the on-record baseline (§1.7 rule 4);
compare future money-boundary audits against it.
