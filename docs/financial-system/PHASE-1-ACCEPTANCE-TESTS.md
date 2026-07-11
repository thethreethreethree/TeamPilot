# Phase 1 — Correctness Contract (Acceptance Tests)

**Status: PROPOSAL — the test-first contract for Phase 1. No implementation code.** These are the
assertions the build must pass before any Phase-1 feature is marked TESTED (FinancialSystem.md:
"write tests for every calculation; no calculation ships untested"). They are behavior-level, so
they hold against the confirmed data model regardless of column details. On confirmation, each `[T-n]`
becomes a real test (Postgres-level for the invariants, Vitest for the service/report layer).

Notation: **MUST** = a hard invariant whose violation corrupts the ledger; every MUST is enforced
in Postgres, not only app code.

---

## Cross-cutting non-negotiables (apply to every feature)

- **[T-1] No floats.** Every money column is `numeric`; no test may observe a `float`/`double`
  money value. No money value is produced by JavaScript arithmetic (money crosses into TS only as
  a string).
- **[T-2] Tenant isolation.** For every `fin_` table: a user in company A **cannot** SELECT, INSERT,
  UPDATE, or reference a row belonging to company B. (One test per table, mirroring the app's RLS
  suite.)
- **[T-3] Traceability.** Every derived figure (account balance, trial-balance line, statement
  total) **equals** the SUM of the specific posted lines it claims to summarize — asserted by
  recomputing from `fin_journal_lines` independently.

---

## 1. Chart of Accounts

- **[T-4] MUST: type ↔ normal_balance consistency.** Creating an `asset`/`expense` account with
  `normal_balance='credit'` (or `liability`/`equity`/`revenue` with `'debit'`) is **rejected** by a
  CHECK. (6 cases: one valid + one invalid per direction.)
- **[T-5] Unique code per company.** Two accounts with the same `code` in one company → rejected;
  the same `code` in two different companies → allowed.
- **[T-6] No hard-delete of a used account.** Deleting an account that has any `fin_journal_lines`
  → rejected; soft-disable (`is_active=false`) → allowed.
- **[T-7] System accounts protected.** Deleting an `is_system` account → rejected.

## 2. Double-entry ledger (the crux)

- **[T-8] MUST: a posted entry balances.** For every entry with `status='posted'`,
  `SUM(base_debit) = SUM(base_credit)`. An attempt to post an unbalanced entry is **rejected by
  the post-RPC AND by the deferred constraint trigger** (test both paths — the RPC path and a
  direct-write path that bypasses the RPC).
- **[T-9] MUST: minimum two lines.** Posting an entry with < 2 lines → rejected.
- **[T-10] MUST: line is debit XOR credit.** A line with both `debit>0` and `credit>0`, or both `=0`
  → rejected by CHECK.
- **[T-11] MUST: derived balance correctness.** `account_balance(a) = SUM(posted base_debit) −
  SUM(posted base_credit)` over that account's lines, sign-presented by its normal balance; equals
  an independent recomputation. No balance is read from a stored column (there is none).
- **[T-12] MUST: company trial balance nets to zero.** `SUM(all posted base_debit) = SUM(all posted
  base_credit)` across the whole company (the accounting equation holds globally).
- **[T-13] Draft entries excluded.** A `draft`/`pending_approval`/`void` entry contributes **zero**
  to any balance, trial balance, or report.

## 3. Journal entries + approval workflow

- **[T-14] MUST: posted is immutable.** UPDATE or DELETE of a `posted` entry or its lines →
  rejected (append-only). Editing a `draft` → allowed.
- **[T-15] MUST: segregation of duties.** Posting where `approved_by = created_by` → rejected.
- **[T-16] Role gate on posting.** `accountant`/`viewer` posting an entry → rejected;
  `approver`/`controller`/`cfo` → allowed.
- **[T-17] Reversal correctness.** Reversing a posted entry creates a **new** posted entry whose
  lines are the debit/credit swap of the original; the original is **unchanged**; the pair nets to
  zero on every affected account.

## 4. Fiscal periods

- **[T-18] MUST: closed-period immutability.** INSERT/UPDATE/DELETE of an entry or line whose
  `period_id` is `closed` or `locked` → rejected. Correction is a new entry in an open period.
- **[T-19] Post requires open period.** Posting into a `closed`/`locked` period → rejected.
- **[T-20] Non-overlapping periods.** Creating a period overlapping an existing one in the same
  company → rejected.
- **[T-21] Close/reopen gated.** Only `controller`/`cfo` may close; reopening a `locked` period
  requires an explicit unlock (audited).

## 5. Multi-currency

- **[T-22] MUST: balance is checked in BASE currency.** An entry with a EUR line and a USD line
  that balance only after conversion → posts iff `SUM(base_debit)=SUM(base_credit)`; a
  transaction-currency-only balance that fails in base → rejected.
- **[T-23] Conversion correctness.** `base_debit = round(debit × fx_rate, 4)` (and credit); asserted
  on known rate fixtures (e.g. 100.00 EUR × 1.0850 = 108.5000 base).
- **[T-24] Deterministic rounding.** Base amounts round half-away-from-zero to 4 dp consistently;
  a fixed fixture set produces exact, stable results (no float drift).
- **[T-25] Rate provenance.** A manually entered rate records `source='manual'` + `created_by`; the
  `RateProvider` seam returns the same shape so an API source is a drop-in (no schema change).

## 6. Immutable audit trail

- **[T-26] MUST: append-only.** UPDATE or DELETE of any `fin_audit_log` row → rejected.
- **[T-27] Coverage.** Each of {entry posted, entry voided, period closed, account created, rate
  set, finance-role granted} writes exactly one audit row with `actor`, `action`, `before_value`,
  `after_value`, `occurred_at`. `before_value` is null on create, populated on change.

---

## Definition of done (per feature, for the manifest)

A Phase-1 feature moves to **TESTED** only when: its `[T-n]` assertions pass, the MUST-invariants
are demonstrated to reject the bad path at the **database** level (not just the service layer), and
tenant isolation `[T-2]` is proven for its table. Anything short of that stays `BUILT` (code exists,
correctness not yet proven) — never silently "done."

*No implementation code here — this is the contract the implementation will be held to.*
