/**
 * The single money formatter for every finance surface. Before this, the statements page used
 * toLocaleString (thousands separators: "$1,234,567.00") while AP/AR/Expenses/Recurring used a bare
 * toFixed(2) ("$1234567.00") — the same value rendered inconsistently across sibling pages, which
 * reads as unpolished in a financial product. One helper keeps them consistent and de-duplicates the
 * five near-identical copies.
 *
 * Presentation only — never money math (all authoritative money math is SQL; see the money-math
 * boundary audit). A non-finite/nullish input renders as $0.00 rather than "$NaN".
 */
export function formatMoney(n: number | null | undefined): string {
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Client-side tax auto-calc for the bill/invoice line editors (AP + AR duplicated this inline).
 * ENTRY CONVENIENCE ONLY — the authoritative tax posting is SQL (fin_approve_bill / fin_issue_invoice
 * sum the stored tax_amount into the 1200/2100 legs). This just prefills the editable tax field from
 * the selected code's rate: tax = amount × rate%. Returns a 2-decimal string (matching the line field's
 * shape); a non-finite amount or rate yields "0.00". The user can override the result afterward.
 */
export function computeLineTax(
  amount: number | string | null | undefined,
  ratePct: number | null | undefined,
): string {
  const a = Number(amount);
  const r = Number(ratePct);
  return (((Number.isFinite(a) ? a : 0) * (Number.isFinite(r) ? r : 0)) / 100).toFixed(2);
}
