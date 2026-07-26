# Finance layer — ground-up audit (§1.7), 2026-07-26

Outside-view stance (§1.3). Foundation-up: **application layer first (this doc's completed half), DB layer
second (in progress).** Recorded incrementally on the immutable record (§1.7.4) so a later audit can compare.
Evidence-driven (§1.5.2): hypotheses formed first, then verified — not mechanical grep.

## Scope + method
The double-entry finance layer (GL, AP/AR, expenses, banking, budget, tax, year-end; migrations 0116–0182,
TS in `src/lib/finance/`, routes under `src/app/api/finance/`). This audit looks for NEW money-integrity
issues; the KNOWN finance flags (FX rounding 0118/0119, calendar-FY assumption 0149/0151/0182, monthly
budget-variance 0191, tax credit-note netting) are already tracked in the founder action queue and are not
re-litigated here.

---

## A. Application layer — VERIFIED SOUND

### A1. No service-role RLS bypass on any finance route
Every finance route authenticates with `createClient()` — the **session** client (RLS-enforced) — and
`sb.auth.getUser()`; **none** uses `createAdminClient()` (service-role, which would bypass RLS). Confirmed
across all write/read routes:
- `ap/bills/[id]/approve/route.ts:15,19` — session client; delegates to the `fin_approve_bill` RPC, which
  enforces capability + period + draft-state **in the DB** (route comment `:7,21`).
- `opening-balances/route.ts:28,80`, `payroll/route.ts:31,82` (payroll adds a `getCurrentCompanyId()` pin
  as defense-in-depth, `:85`), `ar/invoices/[id]/route.ts:15`, `ap/bills/[id]/route.ts:15` — all session
  client, RLS-scoped by the company pin on each `fin_*` table.

**Verdict:** the app layer introduces no finance authz/isolation hole — integrity + capability enforcement
correctly lives in the DB (RLS + RPCs), not in bypassing route code. The audit's real surface is the DB.

### A2. Money-math boundary — no authoritative arithmetic in float-JS
Per the "never float for money" discipline (proved-with-exact-decimal lesson). Swept `src/lib/finance/`:
- `format.ts:11 formatMoney` — presentation only (documented `:8`).
- `format.ts:44 computeLineTax` — an **editable prefill** for the tax field; explicitly rounds to integer
  cents half-up BEFORE formatting (`:52-61`) to avoid the float half-cent bug ($100.50 @ 1% = 1.005 stored
  as 1.00499… → naive `toFixed` yields a cent-light "1.00"). Authoritative tax posting stays in SQL
  (`fin_approve_bill` / `fin_issue_invoice`). Correctly handled.
- `trialBalance.ts:109 tbImbalance` — surfaces an **imported** trial balance's imbalance as a fact to
  display (`:107-108` "never a defect to correct"), 4-dec rounded; not an enforcement gate on our ledger.
- `parseMoneyInput` — input parsing, NaN-guarded so a bad figure can't silently post as 0.

**Verdict:** all authoritative money math is SQL; the TS layer is display/prefill/parse only, and the one
arithmetic prefill handles the float trap. Sound.

---

## B. DB layer — hypotheses OPEN (verification in progress)

The load-bearing money-integrity checks are all in the DB. Verifying these against the current (highest-
numbered `create or replace`) definitions:

- **H1 — closed-period posting (highest consequence):** can a journal entry post into an already-closed
  period/fiscal year? Evidence it's *checked*: `fin_approve_bill` surfaces a **"no open period"** error
  (approve route comment `:21`) — so the bill path enforces it. OPEN: confirm the check at the SQL level,
  and whether EVERY posting path (manual journals, AR invoices, expenses, payroll) enforces it, not just
  bill approval. A path that skips it could corrupt closed books.
- **H2 — posted-entry immutability:** is there a trigger blocking UPDATE/DELETE on `fin_journal_entries` /
  `fin_journal_lines` once posted (reverse-don't-edit)? OPEN.
- **H3 — balance-check completeness:** `fin_assert_balanced` (debits == credits) — does it fire on all
  mutation paths incl. late line UPDATEs, and is it a deferred constraint trigger or an AFTER-row trigger?
  OPEN.
- **H4 — DB tenant isolation:** SELECT/INSERT/UPDATE policies on `fin_journal_*`/`fin_accounts`/bills/
  invoices scoped by company_id, none `using(true)`. OPEN.

_DB-layer verdicts appended once the enforcement map is confirmed._
