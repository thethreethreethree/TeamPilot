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
