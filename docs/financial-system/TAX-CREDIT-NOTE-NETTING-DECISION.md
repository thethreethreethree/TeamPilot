# Decision needed — tax report netting for credit-note reversals

**Status: DECISION — awaiting your call.** Surfaced by the 2026-07-13 money-logic review sweep. A live
amber warning is on the Tax page and a code note is in `0150` so no one files a wrong number meanwhile.

## The problem (one paragraph)

`fin_tax_report` computes output tax as the gross sum of **invoice-line** tax and input tax as the gross
sum of **bill-line** tax, netted by jurisdiction. It never subtracts the output tax that **issued credit
notes reverse** (a credit note posts `Dr Taxes Payable 2100`). So for a period containing credited
invoices, the report **overstates the tax owed**. The *ledger* is correct — the 2100 Taxes Payable
balance already nets the reversal; only this *report* is un-netted. The report is what you file from, so
the number needs to be right.

## Why it isn't a one-line fix

To subtract a credit note's tax **by jurisdiction**, we need to know *which* jurisdiction it belongs to.
But `fin_credit_note_lines` carries **no `tax_code_id`** — a credit note records `amount` + `tax_amount`
per line, with no tax code, hence no jurisdiction. A credit note *does* link to exactly one invoice
(`invoice_id`), and that invoice's lines *do* have tax codes. So the jurisdiction has to be **derived
from the linked invoice** — and that derivation is the decision.

## Options

| # | Attribution rule | Pro | Con |
|---|---|---|---|
| A | **Proportional to the linked invoice's tax by jurisdiction** (recommended) | Most correct: splits the credit's tax across exactly the jurisdictions the original invoice taxed, in the same ratio. Single-jurisdiction invoices (the common case) attribute cleanly. | Slightly more SQL (a proportional split); needs a rule when the invoice itself had zero tax. |
| B | **The linked invoice's *dominant* jurisdiction** (the one with the most tax) | Simplest to implement; correct whenever the invoice is single-jurisdiction (most are). | Wrong when one invoice mixes jurisdictions — puts all the credit's tax in one bucket. |
| C | **An "Unassigned" bucket** (net at the total level only) | Trivial; the **total** net tax becomes correct immediately. | The per-jurisdiction rows stay gross, so rows don't reconcile to the (now-lower) total — potentially more confusing than the current honest warning. |

## Recommendation — **A (proportional to the linked invoice's jurisdictions)**

Reasoning: a credit note is definitionally a reversal *of a specific invoice*, so its tax belongs to
exactly the jurisdictions that invoice charged. Proportional split is the only rule that stays correct
when an invoice mixes jurisdictions, and it degenerates to the obvious answer (100% to the one
jurisdiction) for the common single-jurisdiction invoice. Edge rule: if the linked invoice had **zero
tax** (so no jurisdiction to inherit), attribute the credit's tax — if any — to **Unassigned** and it
shows there honestly.

If you'd rather keep it simple and you never mix jurisdictions on a single invoice, **B** is
functionally identical to A for you and less code. **C** I'd avoid — a total that doesn't match its rows
trades one honesty problem for another.

## If confirmed (A)

A new migration re-creates `fin_tax_report`: add an `out_credit` CTE that, per issued credit note,
splits its `tax_amount` across the linked invoice's jurisdictions in proportion to that invoice's
per-jurisdiction tax (falling back to Unassigned when the invoice had no tax), then subtract it from
`out_tax` per jurisdiction. Remove the amber warning from the Tax page. Add an acceptance test:
invoice with tax in J1 → full credit → report shows net output tax 0 for J1.
