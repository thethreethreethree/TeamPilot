import { describe, it, expect } from "vitest";
import { byCallCount, byContactCount, byDealSize, byDuration, byMention, byPower, overallWinRate, powerOnDeal, MIN_CLOSED } from "../winLoss";

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
  it("by what was said: the most-heard trackers, mentioned vs not, closed deals only", () => {
    const ps = [
      ...[1, 2, 3, 4, 5].map((i) => ({ id: `a${i}`, ...d(i < 5 ? "won" : "lost", 2) })),
      ...[1, 2, 3, 4, 5].map((i) => ({ id: `b${i}`, ...d(i < 2 ? "won" : "lost", 2) })),
      { id: "o1", ...d("open", 2) },
    ];
    const mentions: Record<string, string[]> = { a1: ["Pricing"], a2: ["Pricing"], a3: ["Pricing"], a4: ["Pricing"], a5: ["Pricing", "Spectrum"], b1: ["Spectrum"], o1: ["Pricing"] };
    const rows = byMention(ps, mentions);
    expect(rows.map((r) => r.tracker)).toEqual(["Pricing", "Spectrum"]); // most closed deals first; the open deal doesn't count
    expect(rows[0]!.mentioned).toMatchObject({ won: 4, lost: 1, winRate: 0.8 });
    expect(rows[0]!.notMentioned).toMatchObject({ won: 1, lost: 4, winRate: 0.2 });
    expect(rows[1]!.mentioned.winRate).toBeNull(); // 2 deals: too few
  });
  it("only deals with a readable call are compared (review 2026-11-26)", () => {
    const ps = [{ id: "a", ...d("won", 1) }, { id: "b", ...d("lost", 0) }, { id: "c", ...d("lost", 1) }];
    const rows = byMention(ps, { a: ["Pricing"] }, 5, new Set(["a", "c"]));
    expect(rows[0]!.notMentioned).toMatchObject({ won: 0, lost: 1 }); // "b" had no call: left out
  });
  it("a deal-size cut never splits equal amounts across two bands", () => {
    const rows = byDealSize([d("won", 1, 100), d("lost", 1, 500), d("won", 1, 500), d("won", 1, 500), d("lost", 1, 900), d("won", 1, 900)], money);
    const labels = rows.map((r) => r.label);
    expect(labels.filter((l) => l.includes("$500")).length).toBe(1);
  });
});


/** Revenue Phase 4 (Gong F20.10): contacts, power in the deal, time to close. */
describe("win/loss by contacts, power and time to close", () => {
  const won = (o: Record<string, unknown>) => ({ status: "won" as const, amount: 100, callCount: 1, ...o });
  const lost = (o: Record<string, unknown>) => ({ status: "lost" as const, amount: 100, callCount: 1, ...o });
  it("by contact count; empty rows left out", () => {
    const b = byContactCount([won({ contacts: 2 }), lost({ contacts: 0 }), won({ contacts: 3 })]);
    expect(b.map((x) => [x.label, x.won, x.lost])).toEqual([["No contacts", 0, 1], ["2–3 contacts", 2, 0]]);
  });
  it("power: unknown titles are their own row, never 'no power'", () => {
    expect(powerOnDeal([{ rank: "vp" }, { rank: "manager" }])).toBe(true);
    expect(powerOnDeal([{ rank: "manager" }])).toBe(false);
    expect(powerOnDeal([{ rank: "unknown" }])).toBeNull();
    expect(powerOnDeal([])).toBeNull();
    const b = byPower([won({ powerOnDeal: true }), lost({ powerOnDeal: false }), lost({ powerOnDeal: null })]);
    expect(b.map((x) => x.label)).toEqual(["A director, VP or C-level on the deal", "No one that senior", "Titles not known"]);
  });
  it("by time to close; no closing date is its own row", () => {
    const b = byDuration([
      won({ createdAt: "2026-01-01T00:00:00Z", closedAt: "2026-01-10T00:00:00Z" }),
      lost({ createdAt: "2026-01-01T00:00:00Z", closedAt: "2026-05-01T00:00:00Z" }),
      won({ createdAt: "2026-01-01T00:00:00Z", closedAt: null }),
    ]);
    expect(b.map((x) => [x.label, x.won, x.lost])).toEqual([["Closed in under 30 days", 1, 0], ["Over 90 days", 0, 1], ["Closing date not recorded", 1, 0]]);
  });
  it("a rate still needs the minimum closed deals in its row", () => {
    expect(byContactCount([won({ contacts: 1 }), won({ contacts: 1 })])[0]!.winRate).toBeNull();
  });
});
