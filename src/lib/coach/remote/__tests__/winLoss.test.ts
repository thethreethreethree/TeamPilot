import { describe, it, expect } from "vitest";
import { byCallCount, byDealSize, overallWinRate, MIN_CLOSED } from "../winLoss";

/** F20.10 (2026-11-26): win rate by number of calls and by deal size, closed deals only, no rate below MIN_CLOSED. */
const d = (status: "open" | "won" | "lost", callCount: number, amount: number | null = null) => ({ status, callCount, amount });
const money = (n: number) => `$${n}`;

describe("win/loss breakdowns", () => {
  it("counts closed deals only and gives no rate below the minimum", () => {
    expect(overallWinRate([d("won", 1), d("lost", 1), d("open", 3)])).toEqual({ label: "All closed deals", won: 1, lost: 1, winRate: null });
    const five = [d("won", 1), d("won", 1), d("won", 1), d("lost", 1), d("lost", 1)];
    expect(MIN_CLOSED).toBe(5);
    expect(overallWinRate(five).winRate).toBeCloseTo(0.6);
  });
  it("by number of calls, empty rows left out", () => {
    const rows = byCallCount([d("won", 0), d("lost", 2), d("won", 3), d("won", 9), d("open", 1)]);
    expect(rows.map((r) => [r.label, r.won, r.lost])).toEqual([["No calls", 1, 0], ["2–3 calls", 1, 1], ["7 or more calls", 1, 0]]);
  });
  it("by deal size: this pipeline's thirds with their ranges, and deals with no amount apart", () => {
    const rows = byDealSize(
      [d("won", 1, 100), d("lost", 1, 200), d("won", 1, 300), d("won", 1, 400), d("lost", 1, 500), d("won", 1, 600), d("lost", 1, null), d("open", 1, 9999)],
      money,
    );
    expect(rows.map((r) => [r.label, r.won, r.lost])).toEqual([["Smaller ($100–$200)", 1, 1], ["Middle ($300–$400)", 2, 0], ["Larger ($500–$600)", 1, 1], ["No amount set", 0, 1]]);
    expect(byDealSize([d("won", 1, 100), d("lost", 1, 50)], money).map((r) => r.label)).toEqual(["With an amount"]);
  });
});
