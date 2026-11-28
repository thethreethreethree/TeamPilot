import { describe, it, expect } from "vitest";
import { owners, readShares, shareOf, shareTotals } from "../dealSplits";
import { metrics } from "../forecast";

/** Deal splits (0394; F20.12). Pinned: a person's share of a deal; no split = the rep's whole deal; the forecast counts shares and everyone's total is unchanged. */
describe("deal splits", () => {
  it("shareOf: the split's percent, else the whole deal for its rep", () => {
    const d = { repId: "a", split: [{ userId: "a", pct: 60 }, { userId: "b", pct: 40 }] };
    expect(shareOf(d, "a")).toBe(0.6);
    expect(shareOf(d, "b")).toBe(0.4);
    expect(shareOf(d, "c")).toBe(0);
    expect(shareOf({ repId: "a", split: null }, "a")).toBe(1);
    expect(shareOf({ repId: "a" }, "b")).toBe(0);
  });
  it("readShares: stored rows → shares; the rep alone at 100 is no split", () => {
    expect(readShares([{ user_id: "a", pct: 60 }, { user_id: "b", pct: 40 }], "a")).toEqual([{ userId: "a", pct: 60 }, { userId: "b", pct: 40 }]);
    expect(readShares([{ user_id: "a", pct: 100 }], "a")).toBeNull();
    expect(readShares("nope", "a")).toBeNull();
  });
  it("owners: every rep and co-owner", () => {
    expect(owners([{ repId: "a", split: [{ userId: "a", pct: 50 }, { userId: "c", pct: 50 }] }, { repId: "b" }]).sort()).toEqual(["a", "b", "c"]);
  });
  it("the forecast counts each owner's share; the total is unchanged", () => {
    const deals = [
      { repId: "a", status: "won" as const, amount: 1000, closedAt: "2026-11-02T00:00:00Z", split: [{ userId: "a", pct: 60 }, { userId: "b", pct: 40 }] },
      { repId: "b", status: "open" as const, amount: 500, closeDate: "2026-12-10" },
    ];
    expect(metrics(deals, "2026-Q4", "a")).toMatchObject({ closedWon: 600, closedWonCount: 1, openClosing: 0 });
    expect(metrics(deals, "2026-Q4", "b")).toMatchObject({ closedWon: 400, closedWonCount: 1, openClosing: 500 });
    expect(metrics(deals, "2026-Q4")).toMatchObject({ closedWon: 1000, openClosing: 500 });
  });
  it("shareTotals: your share of what you own and co-own, and whether any split applies (10b)", () => {
    const r = shareTotals([
      { repId: "me", status: "open", amount: 1000, split: [{ userId: "me", pct: 60 }, { userId: "x", pct: 40 }] },
      { repId: "me", status: "won", amount: "250", split: null },
      { repId: "x", status: "open", amount: 500, split: [{ userId: "x", pct: 80 }, { userId: "me", pct: 20 }] },
      { repId: "x", status: "lost", amount: 900, split: null },
    ], "me");
    expect(r.totals).toEqual({ open: { count: 2, amount: 700 }, won: { count: 1, amount: 250 }, lost: { count: 0, amount: 0 } });
    expect(r.split).toBe(true);
    expect(shareTotals([{ repId: "me", status: "open", amount: 10 }], "me").split).toBe(false);
  });
});
