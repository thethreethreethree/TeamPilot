import { describe, it, expect } from "vitest";
import { byStage, closeMatches, filterDeals, kindOf, rollUp, type BoardDeal } from "../dealBoard";

/** The deal board's filters, roll-ups and stage grouping (revenue Phase 2): matching and refused pairs. */
const T = "2026-11-27";
const deal = (o: Partial<BoardDeal>): BoardDeal => ({
  id: "d", repId: "r", name: "Deal", status: "open", stageLabel: null, amount: 100, closeDate: null,
  nextCallDate: "2026-11-30", lastCallAt: "2026-11-25T10:00:00Z", createdAt: "2026-11-01T00:00:00Z", nextTodo: null, ...o,
});

describe("close periods", () => {
  it("this month, next month, quarters, overdue, none", () => {
    expect(closeMatches("2026-11-30", "this_month", T)).toBe(true);
    expect(closeMatches("2026-12-01", "this_month", T)).toBe(false);
    expect(closeMatches("2026-12-15", "next_month", T)).toBe(true);
    expect(closeMatches("2026-10-01", "this_quarter", T)).toBe(true);
    expect(closeMatches("2027-01-10", "this_quarter", T)).toBe(false);
    expect(closeMatches("2027-01-10", "next_quarter", T)).toBe(true);
    expect(closeMatches("2026-11-26", "overdue", T)).toBe(true);
    expect(closeMatches("2026-11-27", "overdue", T)).toBe(false);
    expect(closeMatches(null, "none", T)).toBe(true);
    expect(closeMatches(null, "this_month", T)).toBe(false);
  });
  it("next month across a year end", () => {
    expect(closeMatches("2027-01-05", "next_month", "2026-12-10")).toBe(true);
  });
});

describe("filters", () => {
  const a = deal({ id: "a", stageLabel: "Demo", accountId: "acc1", accountName: "Acme", closeDate: "2026-11-30" });
  const b = deal({ id: "b", stageLabel: "Proposal", nextCallDate: null, lastCallAt: null, createdAt: "2026-10-01T00:00:00Z" });
  const c = deal({ id: "c", status: "won" });
  const ids = (xs: BoardDeal[]) => xs.map((x) => x.id);
  it("stage ignores case; '(none)' finds deals with no stage", () => {
    expect(ids(filterDeals([a, b, c], { stage: "demo" }, T))).toEqual(["a"]);
    expect(ids(filterDeals([a, b, c], { stage: "(none)" }, T))).toEqual(["c"]);
  });
  it("account, status, text", () => {
    expect(ids(filterDeals([a, b, c], { accountId: "acc1" }, T))).toEqual(["a"]);
    expect(ids(filterDeals([a, b, c], { status: "won" }, T))).toEqual(["c"]);
    expect(ids(filterDeals([a, b, c], { q: "acme" }, T))).toEqual(["a"]);
  });
  it("risk uses dealRisk's verdict", () => {
    // b: no next call and gone quiet → at risk; a: healthy
    expect(ids(filterDeals([a, b], { risk: "at_risk" }, T))).toEqual(["b"]);
    expect(ids(filterDeals([a, b], { risk: "flagged" }, T))).toEqual(["b"]);
    expect(ids(filterDeals([a, b], { risk: "ok" }, T))).toEqual(["a"]);
  });
  it("no filter keeps everything", () => {
    expect(filterDeals([a, b, c], {}, T)).toHaveLength(3);
  });
});

describe("roll-ups and stages", () => {
  it("a deal with no amount is counted apart, never as 0", () => {
    expect(rollUp([deal({ amount: 50 }), deal({ amount: null })])).toEqual({ count: 2, amount: 50, unpriced: 1 });
  });
  it("groups in the company's order; unlisted labels after, then no stage", () => {
    const stages = [{ name: "Discovery", kind: "open" as const }, { name: "Demo", kind: "open" as const }, { name: "Won", kind: "won" as const }];
    const g = byStage([deal({ stageLabel: "demo" }), deal({ stageLabel: "Legal" }), deal({ stageLabel: null }), deal({ status: "won", stageLabel: "Won" })], stages);
    expect(g.map((x) => [x.name, x.listed, x.deals.length])).toEqual([["Discovery", true, 0], ["Demo", true, 1], ["Legal", false, 1], ["No stage", false, 1]]);
  });
  it("with no list, labels group as they are", () => {
    expect(byStage([deal({ stageLabel: "Demo" })], null).map((x) => x.name)).toEqual(["Demo"]);
  });
  it("kindOf reads the list; an unlisted name is null", () => {
    expect(kindOf([{ name: "Signed", kind: "won" }], " signed ")).toBe("won");
    expect(kindOf([{ name: "Signed", kind: "won" }], "Other")).toBeNull();
    expect(kindOf(null, "Signed")).toBeNull();
  });
});
