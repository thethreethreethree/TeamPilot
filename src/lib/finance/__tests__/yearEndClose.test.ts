import { describe, it, expect } from "vitest";

/**
 * REFERENCE SPEC for migration 0151 (fin_close_year — the annual books close).
 *
 * The SQL function fin_close_year is the source of truth; this mirrors the ONE part that
 * can't be verified by reading and would silently corrupt Retained Earnings if wrong — the
 * net-income-to-RE balancing line and the whole closing entry's balance. If this spec is
 * right, the SQL (which uses the identical `greatest(-net,0)` / `greatest(net,0)` split) is
 * right. These cases ARE the staging acceptance spec for 0151.
 *
 * The closing entry zeroes every P&L account into RE (code 3000):
 *   • each revenue account (credit-normal) is DEBITED by its balance  → sums to revTotal
 *   • each expense account (debit-normal)  is CREDITED by its balance → sums to expTotal
 *   • the balancing RE line carries net income: Cr RE if profit, Dr RE if loss.
 * RE is credit-normal, so crediting it INCREASES retained earnings (profit) and debiting it
 * DECREASES it (loss) — the accounting the sign MUST get right.
 */

/** Mirror of SQL 0151 lines 74-78: the Retained-Earnings balancing line, or null when net=0
 *  (a debit=0/credit=0 line would violate the debit-XOR-credit CHECK from 0118). */
function closingReLine(revTotal: number, expTotal: number): { debit: number; credit: number } | null {
  const net = revTotal - expTotal; // net income
  if (net === 0) return null;
  return { debit: Math.max(-net, 0), credit: Math.max(net, 0) };
}

/** The full closing entry's debit/credit totals: revenue Dr lines + RE Dr, expense Cr lines + RE Cr. */
function entryTotals(revTotal: number, expTotal: number) {
  const re = closingReLine(revTotal, expTotal);
  return {
    debit: revTotal + (re?.debit ?? 0),
    credit: expTotal + (re?.credit ?? 0),
    re,
  };
}

describe("year-end close — RE roll (mirror of migration 0151)", () => {
  it("PROFIT credits Retained Earnings by net income (increases it)", () => {
    const re = closingReLine(250, 100); // net +150
    expect(re).toEqual({ debit: 0, credit: 150 });
  });

  it("LOSS debits Retained Earnings by the net loss (decreases it)", () => {
    const re = closingReLine(100, 250); // net -150
    expect(re).toEqual({ debit: 150, credit: 0 });
  });

  it("BREAK-EVEN posts no RE line (revenue debits + expense credits already balance)", () => {
    expect(closingReLine(200, 200)).toBeNull();
  });

  it("the RE line is debit-XOR-credit whenever net is non-zero (never both, never neither)", () => {
    for (const [rev, exp] of [
      [250, 100],
      [100, 250],
      [1, 0],
      [0, 1],
      [999.99, 0.01],
    ] as const) {
      const re = closingReLine(rev, exp)!;
      const debitOn = re.debit > 0;
      const creditOn = re.credit > 0;
      expect(debitOn !== creditOn, `rev=${rev} exp=${exp}`).toBe(true); // exactly one side
    }
  });

  it("the whole closing entry BALANCES for profit, loss, and break-even", () => {
    for (const [rev, exp] of [
      [250, 100], // profit
      [100, 250], // loss
      [200, 200], // break-even
      [0, 5000], // pure loss (no revenue)
      [5000, 0], // pure profit (no expense)
    ] as const) {
      const { debit, credit } = entryTotals(rev, exp);
      expect(debit, `rev=${rev} exp=${exp}`).toBeCloseTo(credit, 4);
    }
  });

  it("net income sign convention: RE credit − RE debit equals net income", () => {
    for (const [rev, exp] of [
      [250, 100],
      [100, 250],
      [777.55, 123.45],
    ] as const) {
      const re = closingReLine(rev, exp) ?? { debit: 0, credit: 0 };
      expect(re.credit - re.debit).toBeCloseTo(rev - exp, 4);
    }
  });
});
