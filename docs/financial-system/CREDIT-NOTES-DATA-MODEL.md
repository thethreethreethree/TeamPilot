# Credit Notes / Refunds — Data Model Proposal

**Status: PROPOSAL — awaiting confirmation.** This ADDS a data model, so the per-phase gate genuinely
applies (unlike the read-only statements). Produced so the decision is ready to make; nothing is
built until you confirm the options below.

## The unmet need

When a customer is over-billed, returns goods/services, or is granted a goodwill adjustment, you must
reduce what they owe **without deleting the original invoice** (events are append-only, section 3.1).
A **credit note** is the append-only instrument that does this: it posts its own journal entry that
partially or fully offsets the invoice, and it leaves a visible audit trail of *why* the reduction
happened. Deleting/editing the invoice would violate the ledger's immutability; a credit note is the
correct, auditable mechanism.

## The core decision — accounting treatment

A credit note reverses part of the original invoice (which was `Dr AR / Cr Revenue / Cr Tax Payable`).
The question is which account takes the debit:

- **(a) Contra-revenue (RECOMMENDED).** `Dr "Sales Returns & Allowances" (4900, a contra-revenue
  account) / Dr Tax Payable (reverse output tax) / Cr Accounts Receivable`. Preserves **gross**
  revenue on the P&L and shows returns as their own visible line — auditors and analysts can see the
  returns rate. Standard practice.
- **(b) Direct-to-revenue.** `Dr Revenue (4000) / Dr Tax Payable / Cr AR`. Nets returns straight into
  revenue; simpler, but the returns magnitude is invisible on the P&L.

Both reduce net income and AR by the identical amount — the only difference is P&L visibility. (a) is
recommended; it needs one new seeded COA account, `4900 Sales Returns & Allowances` (contra-revenue).

## Proposed tables (new)

1. **`fin_credit_notes`** — `id`, `company_id`, `customer_id`, **`invoice_id`** (the invoice being
   credited), `credit_number` (unique per company), `credit_date`, `reason`, `memo`,
   `status` (`draft` | `issued`), `posted_entry_id`, `created_by`, `issued_by`, `created_at`.
   Corrections after issue are done by a **reversing** credit note, never an edit (append-only).
2. **`fin_credit_note_lines`** — `id`, `company_id`, `credit_note_id`, `line_no`, `account_id`
   (the revenue-or-contra account to debit), `description`, `amount`, `tax_amount`. Mirrors invoice
   lines, so a partial credit can target specific revenue lines.

## GL posting (`fin_issue_credit_note`)

Mirrors `fin_issue_invoice`, reversed: for each line `Dr account_id (4900 contra, or the line's
revenue account)`; `Dr Tax Payable` for the summed tax; `Cr Accounts Receivable (1100)` for the
grand total. Balanced by construction, posted through the 0122 system-primitive, linked in
`fin_source_postings` (`source_type = 'ar_credit_note'`, `kind = 'issue'`).

## The critical ripple — outstanding + aging (holistic, section 1.5)

This is the part that must not be missed: a credit note against an invoice **reduces that invoice's
effective outstanding**. Two existing derivations must be updated or every credited invoice will keep
showing as fully owed:

- **`fin_invoice_summary`** — `outstanding = invoice_total − receipts_applied − credits_applied`.
- **`fin_ar_aging`** — same subtraction, so a credited invoice ages down / clears correctly.

Both changes are additive `left join` sums against `fin_credit_notes` (issued) by `invoice_id`. The
collections worklist and the dashboard AR-outstanding then reflect credits automatically (they read
these views).

## RPC design + guards (consistent with the rest of the subledger)

`fin_issue_credit_note(p_credit_note_id)` — `SECURITY DEFINER`, guarded by `fin_can_approve()`
(issuing a credit reduces revenue → an approval-level control, not data-entry), tenant check, and
**SoD** (`created_by <> issuer`, mirroring invoices/bills). Validates the credit total **≤ the
invoice's remaining outstanding** (see decision 4). Draft-lock RLS (editable only while `draft`),
`fin_audit` trigger. Reversal = a new credit note through the normal path (never an edit).

## Decisions I need before building

1. **Accounting treatment** — contra-revenue 4900 *(recommended)* vs direct-to-revenue 4000?
2. **Application model** — credit tied to **one invoice** *(recommended, simple)* vs **standalone
   applicable credits** (a customer credit balance that can be applied across invoices later; needs a
   `fin_credit_applications` link table + an "unapplied credit" concept — more powerful, more work)?
3. **Lines vs single amount** — mirror invoice lines *(recommended, consistent)* vs a single amount +
   one target account (simpler UI, less granular)?
4. **Over-credit** — may a credit exceed the invoice's outstanding? *Recommend no* for the simple
   model: a credit is bounded by what's still owed. Crediting more than owed implies returning cash
   already collected — that's a **refund** (decision 5), a different instrument.
5. **Cash refunds** — separate from credit notes, now or later? A credit note reduces AR (what they
   still owe); a **refund** returns cash they already paid (`Dr AR/contra / Cr Cash`). If you need to
   hand money back (not just cancel a balance), that's a small additional RPC. Confirm: credits only
   now / credits + refunds now.

## AMD-006 four-layer check

- **L1 structure** — mirrors the invoice→receipt pattern (table + lines + RPC + source-posting + view
  updates + RLS + audit); no new architectural shape, fits the subledger.
- **L2 effectivity** — issuing a credit reduces the customer's outstanding and reverses revenue
  correctly, end-to-end, posted to a balanced GL entry.
- **L3 continuity** — a "Credit" action on an issued invoice on the AR page; the invoice's outstanding
  updates; aging + collections reflect it; next action obvious.
- **L4 surface** — a credit-note form + a credits list on AR; the invoice shows credits applied.

## If confirmed

One migration `0141_fin_credit_notes.sql` (tables + `fin_issue_credit_note` + `fin_invoice_summary`
and `fin_ar_aging` view updates + `fin_source_postings` link + RLS + audit + the `4900` COA seed if
contra chosen), an `/api/finance/ar/credit-notes` route pair, and the AR-page UI. An acceptance script
for the balance (credit total = AR reduction) and the outstanding-subtraction ripple.
