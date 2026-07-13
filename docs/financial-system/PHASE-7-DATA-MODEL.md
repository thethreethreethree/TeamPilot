# Phase 7 — Data Model Proposal (Tax & Compliance)

**Status: PROPOSAL — awaiting confirmation.** Tax already partly exists: lines carry `tax_amount`, the
posting functions route it to **Tax Payable (2100)** on sales and **Tax Receivable (1200)** on
purchases, and it flows to the GL. Phase 7 formalizes the *rates* (tax codes), *auto-calculation*,
*liability reporting*, and the *year-end close*. Like the other phases, this scopes a first increment.

## Principle

Tax is booked to real liability/asset accounts (2100/1200) as it happens — the liability is always the
live account balance, never a separately-maintained number. Tax codes are configuration (rate ×
jurisdiction × which account); a filing report is a slice of the already-booked tax by period. Nothing
new is invented — Phase 7 makes the existing tax handling *driven by codes* and *reportable*.

## Proposed tables (first increment)

1. **`fin_tax_codes`** — `code`, `name`, `jurisdiction`, `rate_pct`, `kind` (`sales`/`vat`/`gst`),
   `direction` (`output` = on sales → 2100, `input` = on purchases → 1200), `is_active`. The tax
   catalog.
2. **Optional `tax_code_id`** (nullable FK) on the line tables (`fin_bill_lines`, `fin_invoice_lines`)
   — so a line records *which* tax applied. Auto-calc: when a `tax_code_id` is set, the UI computes
   `tax_amount = amount × rate_pct/100` (still overridable — the API already accepts an explicit
   `tax_amount`). Backward compatible: existing manual-tax lines keep working (`tax_code_id` null).

## Derivations (views/RPCs — no stored tax totals)

- **Tax liability** — `fin_tax_liability(from, to)`: output tax (2100 activity) − input tax (1200
  activity) over the period = net tax owed/refundable, grouped by jurisdiction via the tax code. It's
  the account activity you already post, sliced.
- **Tax filing report** — the same, formatted per jurisdiction/period for a return.

## Year-end close (the notable new *process*)

**`fin_close_year(fiscal_year)`** posts the standard **closing entries**: zero out the revenue and
expense accounts into **Retained Earnings (an equity account, seed 3900)** for the year, and lock the
year's periods. This is real double-entry (Dr each revenue / Cr Retained Earnings; Cr each expense /
Dr Retained Earnings), fully reversible via a re-open. **Bonus:** it also cleans up the date-ranged
Balance Sheet nuance flagged in 0144 — after close, prior-year P&L lives in Retained Earnings, so an
as-of balance sheet reads correctly without the "cumulative net income" caveat.

## Decisions I need before building

1. **Tax-code model** — a `fin_tax_codes` catalog (rate × jurisdiction × direction) [recommended], or
   is a single company tax rate enough for you?
2. **Auto-calc vs manual** — add an optional `tax_code_id` on lines that auto-computes tax (with manual
   override) [recommended], or keep tax purely manual as today?
3. **1099 / contractor reporting** — needed now? It's US-specific (annual payments to flagged
   vendors). Recommend **defer** unless you file 1099s — say the word if you do.
4. **Year-end close** — build the closing-entry process now [recommended — it's real accounting and
   fixes the ranged-BS caveat], or defer? Needs a Retained Earnings account (seed 3900).
5. **First-increment scope** — recommend: tax codes + auto-calc + liability/filing report + year-end
   close. **Defer:** 1099 reporting (jurisdiction-specific).

## AMD-006 four-layer check

- **L1 structure** — tax codes are config; `tax_code_id` is a nullable line column; liability is a
  view over existing 2100/1200 activity; close posts real journal entries. No parallel tax ledger.
- **L2 effectivity** — set a 20% VAT code, add an invoice line → tax auto-fills → posts to 2100 → the
  liability report shows it, end-to-end.
- **L3 continuity** — a Tax page: manage codes, a liability/filing report by period; a "Close year"
  action on the Periods page.
- **L4 surface** — tax-code picker on the line editors; a tax report; a year-end-close confirmation.

## If confirmed

Likely two migrations: `0150` (fin_tax_codes + `tax_code_id` on line tables + fin_tax_liability view +
seed Retained Earnings 3900) and `0151` (fin_close_year + reopen), plus the tax-code picker in the
line editors, a Tax report page, and a Close-year action — with acceptance tests for the liability
math and the closing-entry balance. 1099 = a later increment.
