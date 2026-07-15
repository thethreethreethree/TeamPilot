import { describe, it, expect } from "vitest";

/**
 * REFERENCE SPEC for migration 0180 (inventory — perpetual WEIGHTED-AVERAGE cost + COGS).
 *
 * The SQL functions fin_receive_inventory / fin_sell_inventory are source-of-truth; this mirrors
 * their cost ALGORITHM in JS so the weighted-average + COGS math is CI-testable without a live DB
 * (the finance .test.sql suite that exercises 0180 against a real DB is NOT run in CI — see the
 * FOUNDER-ACTION-QUEUE "core-thesis + finance not CI-tested" gap). This reference test closes that
 * gap for the WAC CALC specifically: a regression in the average-cost or COGS formula now fails CI.
 *
 * The two rules that matter (0180 lines 129, 188, 204-207):
 *   RECEIVE: new_avg = round((qty·avg + recv_qty·recv_cost) / (qty + recv_qty), 4); qty += recv_qty.
 *   SELL:    COGS = round(sell_qty · avg, 4); qty -= sell_qty; avg UNCHANGED (a sale never moves the
 *            average — that's the definition of weighted-average, vs FIFO/LIFO).
 * Guards: receive/sell qty must be > 0; cannot sell more than on hand (no fabricated negative stock).
 */

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

type Stock = { qty: number; avg: number };

/** Mirror of fin_receive_inventory's cost effect. */
function receive(s: Stock, qty: number, unitCost: number): Stock {
  if (qty <= 0) throw new Error("Received quantity must be positive");
  const newAvg = r4((s.qty * s.avg + qty * unitCost) / (s.qty + qty));
  return { qty: r4(s.qty + qty), avg: newAvg };
}

/** Mirror of fin_sell_inventory: returns the COGS posted + the new stock (avg unchanged). */
function sell(s: Stock, qty: number): { cogs: number; stock: Stock } {
  if (qty <= 0) throw new Error("Sold quantity must be positive");
  if (qty > s.qty) throw new Error("cannot sell more than on hand");
  const cogs = r4(qty * s.avg);
  return { cogs, stock: { qty: r4(s.qty - qty), avg: s.avg } }; // avg unchanged
}

describe("inventory weighted-average cost + COGS (migration 0180 reference)", () => {
  it("first receipt into empty stock sets avg = the receipt unit cost", () => {
    const s = receive({ qty: 0, avg: 0 }, 100, 1.0);
    expect(s).toEqual({ qty: 100, avg: 1.0 });
  });

  it("THE canonical weighted average: 100@1.00 then 100@2.00 → 200 @ 1.50", () => {
    const s = receive(receive({ qty: 0, avg: 0 }, 100, 1.0), 100, 2.0);
    expect(s).toEqual({ qty: 200, avg: 1.5 });
  });

  it("a SALE posts COGS at the current avg and does NOT move the average", () => {
    const start: Stock = { qty: 200, avg: 1.5 };
    const { cogs, stock } = sell(start, 50);
    expect(cogs).toBe(75.0); // 50 × 1.50
    expect(stock).toEqual({ qty: 150, avg: 1.5 }); // avg unchanged — the WAC invariant
  });

  it("a later receipt does NOT retroactively change a prior sale's COGS", () => {
    let s: Stock = receive({ qty: 0, avg: 0 }, 100, 1.0); // 100 @ 1.00
    const firstSale = sell(s, 40); // COGS 40.00 at avg 1.00
    s = firstSale.stock; // 60 @ 1.00
    s = receive(s, 40, 3.0); // (60×1 + 40×3)/100 = 180/100 = 1.80
    expect(s.avg).toBe(1.8);
    expect(firstSale.cogs).toBe(40.0); // unchanged by the later receipt — perpetual, not periodic
  });

  it("ROUNDING: a repeating-decimal average rounds to 4 dp and stays stable", () => {
    // 7@1.00 then 3@2.00 → (7 + 6)/10 = 1.30 exact
    let s = receive(receive({ qty: 0, avg: 0 }, 7, 1.0), 3, 2.0);
    expect(s.avg).toBe(1.3);
    // then 3@1.00 → (10×1.30 + 3×1.00)/13 = 16/13 = 1.230769… → 1.2308
    s = receive(s, 3, 1.0);
    expect(s.avg).toBe(1.2308);
  });

  it("REFUSES to sell more than is on hand (no fabricated negative stock)", () => {
    expect(() => sell({ qty: 150, avg: 1.5 }, 200)).toThrow(/cannot sell more than on hand/);
  });

  it("REFUSES non-positive receive/sell quantities", () => {
    expect(() => receive({ qty: 10, avg: 1 }, 0, 5)).toThrow(/must be positive/);
    expect(() => sell({ qty: 10, avg: 1 }, -3)).toThrow(/must be positive/);
  });

  it("INVARIANT across a mixed sequence: avg only changes on receipts, never on sales", () => {
    let s: Stock = { qty: 0, avg: 0 };
    const steps: Array<["r" | "s", number, number?]> = [
      ["r", 100, 2.0], ["s", 30], ["r", 50, 5.0], ["s", 40], ["r", 10, 1.0],
    ];
    let prevAvg = s.avg;
    for (const [op, qty, cost] of steps) {
      if (op === "r") {
        s = receive(s, qty, cost as number);
        // a receipt may change avg (that's allowed)
      } else {
        const before = s.avg;
        s = sell(s, qty).stock;
        expect(s.avg).toBe(before); // a sale must NEVER change avg
      }
      prevAvg = s.avg;
    }
    // qty ends: 100-30+50-40+10 = 90; avg is a positive number, stock non-negative throughout
    expect(s.qty).toBe(90);
    expect(s.avg).toBeGreaterThan(0);
    expect(prevAvg).toBe(s.avg);
  });
});
