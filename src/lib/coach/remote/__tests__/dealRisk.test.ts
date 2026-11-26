import { describe, it, expect } from "vitest";
import { byQuarter, dealRisk, forecast, forecastByMonth, MIN_CLOSED_FOR_FORECAST, withMovedDates } from "../dealRisk";

const TODAY = "2026-11-23";
const p = (over: Partial<Parameters<typeof dealRisk>[0]> = {}) => ({
  id: "p", name: "Acme", status: "open" as const, amount: 1000, nextCallDate: "2026-11-25",
  lastCallAt: "2026-11-20T15:00:00Z", createdAt: "2026-11-01T00:00:00Z", nextTodo: null, ...over,
});

describe("dealRisk", () => {
  it("a healthy deal: next call booked, recent call, no overdue to-do", () => {
    expect(dealRisk(p(), TODAY)).toEqual({ level: "ok", reasons: [] });
  });
  it("one reason → watch; two → at risk", () => {
    expect(dealRisk(p({ nextCallDate: null }), TODAY)).toEqual({ level: "watch", reasons: ["no_next_call"] });
    expect(dealRisk(p({ nextCallDate: null, nextTodo: { due: "2026-11-20" } }), TODAY).level).toBe("at_risk");
  });
  it("a booked date that passed counts only if no call happened on or after it", () => {
    expect(dealRisk(p({ nextCallDate: "2026-11-18" }), TODAY).reasons).toEqual([]); // called on the 20th
    expect(dealRisk(p({ nextCallDate: "2026-11-21" }), TODAY).reasons).toEqual(["missed_next_call"]);
  });
  it("quiet: 21+ days since the last call, or 14+ days in the pipeline with no call at all", () => {
    expect(dealRisk(p({ lastCallAt: "2026-10-30T12:00:00Z" }), TODAY).reasons).toContain("gone_quiet");
    expect(dealRisk(p({ lastCallAt: null, createdAt: "2026-11-15T00:00:00Z" }), TODAY).reasons).not.toContain("gone_quiet");
    expect(dealRisk(p({ lastCallAt: null, createdAt: "2026-11-05T00:00:00Z" }), TODAY).reasons).toContain("gone_quiet");
  });
  it("a missing amount is shown but never makes a deal at risk on its own", () => {
    expect(dealRisk(p({ amount: null }), TODAY)).toEqual({ level: "ok", reasons: ["no_amount"] });
  });
  it("a customer who cooled on the last call is a reason; with one more, the deal is at risk", () => {
    expect(dealRisk(p({ sentiment: { last: "cooling" } }), TODAY)).toEqual({ level: "watch", reasons: ["cooled"] });
    expect(dealRisk(p({ sentiment: { last: "cooling" }, nextCallDate: null }), TODAY).level).toBe("at_risk");
    expect(dealRisk(p({ sentiment: { last: "warming" } }), TODAY).reasons).toEqual([]);
  });
  it("closed deals are never at risk", () => {
    expect(dealRisk(p({ status: "won", nextCallDate: null }), TODAY)).toEqual({ level: "ok", reasons: [] });
  });
});

describe("forecast", () => {
  const atRisk = p({ id: "r", amount: 400, nextCallDate: null, nextTodo: { due: "2026-11-01" } });
  it(`no forecast number until ${MIN_CLOSED_FOR_FORECAST} deals have closed`, () => {
    const f = forecast([p(), atRisk, p({ status: "won" }), p({ status: "lost" })], TODAY);
    expect(f).toMatchObject({ openCount: 2, openAmount: 1400, closed: 2, winRate: null, expected: null, atRiskCount: 1, atRiskAmount: 400, openWithoutAtRisk: 1000 });
  });
  it("with enough closed deals, expected = open value × this pipeline's win rate", () => {
    const closed = [...Array(3)].map(() => p({ status: "won" })).concat([...Array(2)].map(() => p({ status: "lost" })));
    const f = forecast([p(), atRisk, p({ amount: null }), ...closed], TODAY);
    expect(f.winRate).toBeCloseTo(0.6);
    expect(f.expected).toBeCloseTo(1400 * 0.6);
    expect(f.unpriced).toBe(1);
  });
});

describe("expected close date (0320)", () => {
  it("a passed close date on an open deal is a reason; today or later is not; a closed deal never", () => {
    expect(dealRisk(p({ closeDate: "2026-11-22" }), TODAY).reasons).toEqual(["past_close_date"]);
    expect(dealRisk(p({ closeDate: TODAY }), TODAY).reasons).toEqual([]);
    expect(dealRisk(p({ closeDate: "2026-11-01", status: "won" }), TODAY).reasons).toEqual([]);
    expect(dealRisk(p({ closeDate: "2026-11-01", nextCallDate: null }), TODAY).level).toBe("at_risk");
  });
  it("open deals by expected close month: past due kept apart, undated counted apart, expected only with enough closed deals", () => {
    const open = [
      p({ id: "a", closeDate: "2026-11-30", amount: 1000 }),
      p({ id: "b", closeDate: "2026-12-05", amount: 500 }),
      p({ id: "c", closeDate: "2026-12-20", amount: null }),
      p({ id: "d", closeDate: "2026-11-02", amount: 300 }),
      p({ id: "e", closeDate: null, amount: 700 }),
    ];
    const few = forecastByMonth(open, TODAY);
    expect(few.pastDue).toEqual({ month: "past_due", count: 1, amount: 300, unpriced: 0, expected: null });
    expect(few.months).toEqual([
      { month: "2026-11", count: 1, amount: 1000, unpriced: 0, expected: null },
      { month: "2026-12", count: 2, amount: 500, unpriced: 1, expected: null },
    ]);
    expect(few.undated).toEqual({ count: 1, amount: 700 });
    const closed = [...Array(3)].map((_, i) => p({ id: `w${i}`, status: "won" })).concat([...Array(2)].map((_, i) => p({ id: `l${i}`, status: "lost" })));
    const enough = forecastByMonth([...open, ...closed], TODAY);
    expect(enough.months[1]!.expected).toBeCloseTo(500 * 0.6);
  });
});

describe("byQuarter", () => {
  it("sums months into calendar quarters; expected stays null when unknown", () => {
    const m = (month: string, amount: number, expected: number | null) => ({ month, count: 1, amount, unpriced: 0, expected });
    expect(byQuarter([m("2026-11", 100, null), m("2026-12", 50, null), m("2027-01", 10, null)])).toEqual([
      { month: "2026-Q4", count: 2, amount: 150, unpriced: 0, expected: null },
      { month: "2027-Q1", count: 1, amount: 10, unpriced: 0, expected: null },
    ]);
    expect(byQuarter([m("2026-10", 100, 60), m("2026-12", 50, 30)])[0]!.expected).toBe(90);
  });
});

describe("withMovedDates (what-if)", () => {
  it("moves only the named deals on a copy; '' clears; the originals are untouched", () => {
    const ps = [p({ id: "a", closeDate: "2026-12-01" }), p({ id: "b", closeDate: "2026-12-05" })];
    const w = withMovedDates(ps, { a: "2027-01-10", b: "" });
    expect(w.map((x) => x.closeDate)).toEqual(["2027-01-10", null]);
    expect(ps.map((x) => x.closeDate)).toEqual(["2026-12-01", "2026-12-05"]);
  });
});

/** Revenue Phase 3a (0372; Gong F20.5): each reason fires on its fact and stays silent when the fact wasn't read. */
describe("dealRisk — Gong's warnings from rss_deal_signals", () => {
  const sig = (o: Partial<NonNullable<Parameters<typeof dealRisk>[0]["signals"]>> = {}) => ({
    lastTwoWayAt: "2026-11-20T15:00:00Z", pricingMentioned: true, stageEnteredAt: "2026-11-15T00:00:00Z",
    contacts: [{ rank: "vp" as const, lastOnCall: "2026-11-20T15:00:00Z" }, { rank: "manager" as const, lastOnCall: "2026-11-20T15:00:00Z" }], ...o,
  });
  it("no signals read → none of them fire", () => {
    expect(dealRisk(p({ closeDate: "2026-11-30" }), TODAY).reasons).toEqual([]);
  });
  it("healthy signals → none fire", () => {
    expect(dealRisk(p({ closeDate: "2026-11-30", signals: sig(), callCount: 2 }), TODAY).reasons).toEqual([]);
  });
  it("ghosted: calls happen but the customer hasn't spoken in 7+ days; no calls at all is not ghosted", () => {
    expect(dealRisk(p({ signals: sig({ lastTwoWayAt: "2026-11-10T00:00:00Z" }), callCount: 3 }), TODAY).reasons).toContain("ghosted");
    expect(dealRisk(p({ signals: sig({ lastTwoWayAt: null }), callCount: 1 }), TODAY).reasons).toContain("ghosted");
    expect(dealRisk(p({ signals: sig({ lastTwoWayAt: null }), callCount: 0 }), TODAY).reasons).not.toContain("ghosted");
  });
  it("ghosted with no two-way call yet counts from the deal's start: not on day 0, yes after 7+ days (review 2026-11-27)", () => {
    expect(dealRisk(p({ signals: sig({ lastTwoWayAt: null }), callCount: 1, createdAt: `${TODAY}T08:00:00Z` }), TODAY).reasons).not.toContain("ghosted");
    expect(dealRisk(p({ signals: sig({ lastTwoWayAt: null }), callCount: 1, createdAt: "2026-11-01T08:00:00Z" }), TODAY).reasons).toContain("ghosted");
  });
  it("few contacts once the deal has been open 14+ days", () => {
    const one = sig({ contacts: [{ rank: "vp", lastOnCall: null }] });
    expect(dealRisk(p({ signals: one }), TODAY).reasons).toContain("few_contacts");
    expect(dealRisk(p({ signals: one, createdAt: "2026-11-15T00:00:00Z" }), TODAY).reasons).not.toContain("few_contacts");
  });
  it("no power near close; an active VP prevents it; unknown titles never fire it", () => {
    const juniors = sig({ contacts: [{ rank: "manager", lastOnCall: "2026-11-20T00:00:00Z" }, { rank: "individual", lastOnCall: null }] });
    expect(dealRisk(p({ closeDate: "2026-12-10", signals: juniors }), TODAY).reasons).toContain("no_power");
    expect(dealRisk(p({ closeDate: "2026-12-10", signals: sig() }), TODAY).reasons).not.toContain("no_power");
    expect(dealRisk(p({ closeDate: "2026-12-10", signals: sig({ contacts: [{ rank: "unknown", lastOnCall: null }, { rank: "unknown", lastOnCall: null }] }) }), TODAY).reasons).not.toContain("no_power");
    expect(dealRisk(p({ closeDate: "2027-03-01", signals: juniors }), TODAY).reasons).not.toContain("no_power");
  });
  it("no pricing only within 30 days of close", () => {
    expect(dealRisk(p({ closeDate: "2026-12-10", signals: sig({ pricingMentioned: false }) }), TODAY).reasons).toContain("no_pricing");
    expect(dealRisk(p({ closeDate: "2027-03-01", signals: sig({ pricingMentioned: false }) }), TODAY).reasons).not.toContain("no_pricing");
  });
  it("stalled only past the stage's own limit", () => {
    expect(dealRisk(p({ signals: sig(), stallDays: 5 }), TODAY).reasons).toContain("stalled");
    expect(dealRisk(p({ signals: sig(), stallDays: 10 }), TODAY).reasons).not.toContain("stalled");
    expect(dealRisk(p({ signals: sig(), stallDays: null }), TODAY).reasons).not.toContain("stalled");
  });
  it("two of them make the deal at risk, like any two reasons", () => {
    expect(dealRisk(p({ closeDate: "2026-12-10", signals: sig({ pricingMentioned: false }), stallDays: 5 }), TODAY).level).toBe("at_risk");
  });
});
