# Phase 3 — Data Model Proposal (Banking & Reconciliation)

**Status: PROPOSAL — awaiting confirmation (this phase ADDS a data model, so the gate genuinely
applies, unlike the read-only statements).** The sequenced next phase after Transactions. Goal:
know your real cash position and reconcile the ledger against the bank.

## Principle
The GL stays the source of truth. Bank data is a **separate feed** that gets **matched** to GL
postings; reconciliation is proving "the ledger agrees with the bank." Bank balances never override
GL balances — discrepancies are surfaced, not silently absorbed.

## Proposed tables (new)

1. **`fin_bank_accounts`** — a real bank/card account: `name`, `institution`, `mask` (last-4),
   `currency`, **`gl_account_id`** (the COA cash account it posts to — so each bank account is a
   cash sub-account in the ledger), `is_active`. Multiple accounts supported.
2. **`fin_bank_transactions`** — imported bank lines: `bank_account_id`, `txn_date`, `amount`
   (signed: + deposit / − withdrawal), `description`, `external_id` (dedupe key), `status`
   (`unmatched` | `matched` | `ignored`), `imported_at`, `source` (`csv` | `plaid`).
3. **`fin_reconciliation_matches`** — links a bank transaction to the GL line(s) that represent it:
   `bank_transaction_id`, `entry_id`, `matched_by`, `matched_at`. Append-only.

## Flow
- **Import** bank transactions (CSV first; Plaid later — build-vs-buy below). Dedupe on `external_id`.
- **Auto-match** each bank transaction to a posted GL cash line by amount + date (± a tolerance
  window). Confident single matches → matched; ambiguous/none → surfaced for manual review.
- **Manual reconciliation UI** — an unmatched worklist: match to an existing entry, or create the
  missing GL entry (e.g., a bank fee) on the spot (posts via the 0122 primitive).
- **Cash position dashboard** — real balances per bank account (the linked GL cash account balance),
  + "unreconciled items" count as the honesty signal.

## Build-vs-buy + decisions (need your answers before I build)

1. **Bank feed — CSV import first, or Plaid integration now?**
   Recommend **CSV statement import first** (no external dependency, works immediately, testable),
   with **Plaid** as a later drop-in via the same `fin_bank_transactions` shape (`source='plaid'`).
   Plaid needs API keys + a linking flow + is a paid integration. Confirm: CSV first / Plaid now / both.
2. **Bank-account → COA mapping** — each bank account maps to its own cash GL account (e.g., `1000`
   Cash, `1010` Bank-Operating, …). Recommend one GL cash account per bank account (clean
   reconciliation). Confirm, or say one shared Cash account.
3. **Auto-match tolerance** — match on exact amount + date within ±N days. Recommend ±3 days, exact
   amount. Confirm N.

## Increments (each BUILT→TESTED before the next)
- **3A** — bank accounts + CSV import + dedupe.
- **3B** — auto-match + the reconciliation worklist UI (+ create-missing-entry).
- **3C** — cash-position dashboard + unreconciled signal.
- **3D (flagged)** — Plaid integration, if you choose it.

## What I need to start
Answers to decisions **1–3**. On confirmation I build 3A first (migration + tests), then 3B/3C.
Plaid (3D) only if you opt in.

*Rests on the verified Phase-1 GL + the 0122 subledger primitive. No change to existing tables.*
