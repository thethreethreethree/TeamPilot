import { describe, it, expect } from "vitest";
import { NO_SOURCE, sourceBreakdown, sourcesInUse } from "../leadSource";
import { eventValue } from "../macroMode";

const p = (source: string | null, status: "open" | "won" | "lost", amount: number | null = null) => ({ source, status, amount });

describe("sourceBreakdown", () => {
  const rows = sourceBreakdown([
    p("Webinar", "won", 1000),
    p("webinar ", "lost", 400),
    p("Webinar", "open", 300),
    p("Referral", "open", 900),
    p(null, "won", 50),
    p("  ", "open"),
  ]);
  it("groups ignoring case and spacing, with counts, values and win rate on closed deals", () => {
    expect(rows[0]).toEqual({ source: "Webinar", prospects: 3, open: 1, openAmount: 300, won: 1, wonAmount: 1000, lost: 1, winRate: 0.5 });
  });
  it("a source with no closed deal has no win rate (not 0%)", () => {
    expect(rows.find((r) => r.source === "Referral")).toMatchObject({ prospects: 1, winRate: null });
  });
  it("prospects without a source are one row, last", () => {
    expect(rows[rows.length - 1]).toMatchObject({ source: NO_SOURCE, prospects: 2, won: 1, winRate: 1 });
  });
  it("sourcesInUse lists the named sources only", () => {
    expect(sourcesInUse([{ source: "Webinar" }, { source: "webinar" }, { source: null }, { source: "Event" }])).toEqual(["Event", "Webinar"]);
  });
});

describe("eventValue('source') mirrors 0313's check", () => {
  it("1-60 characters", () => {
    expect(eventValue("source", " Webinar ")).toEqual({ text: "Webinar" });
    expect(eventValue("source", "")).toBeNull();
    expect(eventValue("source", "x".repeat(61))).toBeNull();
    expect(eventValue("source", 5)).toBeNull();
  });
});
