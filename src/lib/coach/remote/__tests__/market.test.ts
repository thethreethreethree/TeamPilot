import { describe, it, expect } from "vitest";
import { computeMarket, MIN_CLOSED, type MarketCall } from "../market";

const call = (id: string, outcome: string | null, day = "2026-11-10"): MarketCall => ({ sessionId: id, startedAt: `${day}T10:00:00Z`, outcome });

describe("computeMarket", () => {
  const calls = [
    ...Array.from({ length: 6 }, (_, i) => call(`a${i}`, i < 2 ? "sold" : "no_sale")), // Acme named: 2 of 6 closed won
    ...Array.from({ length: 6 }, (_, i) => call(`b${i}`, i < 5 ? "sold" : "no_sale")), // no competitor: 5 of 6 won
    call("c0", "follow_up", "2026-11-17"),
    call("none", "sold"), // no intel at all
  ];
  const intel = new Map([
    ...Array.from({ length: 6 }, (_, i) => [`a${i}`, { competitors: [i % 2 ? "Acme" : " acme ", "Acme"], topics: ["Price"] }] as const),
    ...Array.from({ length: 6 }, (_, i) => [`b${i}`, { competitors: [], topics: ["price ", "Install date"] }] as const),
    ["c0", { competitors: ["Zed Corp"], topics: [] }] as const,
  ].map(([k, v]) => [k, { competitors: [...v.competitors], topics: [...v.topics] }]));
  const m = computeMarket(calls, intel);

  it("counts calls with intel; overall win rate over closed calls only", () => {
    expect(m).toMatchObject({ calls: 14, withIntel: 13, closed: 12 });
    expect(m.winRate).toBeCloseTo(7 / 12);
  });
  it("groups a competitor's spellings, counts each call once, and gives its win rate", () => {
    const acme = m.competitors.find((c) => c.name === "Acme")!;
    expect(acme).toMatchObject({ calls: 6, closed: 6 });
    expect(acme.winRate).toBeCloseTo(2 / 6);
    expect(acme.share).toBeCloseTo(6 / 13);
  });
  it(`a competitor with fewer than ${MIN_CLOSED} closed calls has no win rate`, () => {
    expect(m.competitors.find((c) => c.name === "Zed Corp")).toMatchObject({ calls: 1, closed: 0, winRate: null, weeks: [{ weekStart: "2026-11-16", calls: 1 }] });
  });
  it("topics are grouped ignoring case and spacing, most raised first", () => {
    expect(m.topics).toEqual([{ name: "Price", calls: 12 }, { name: "Install date", calls: 6 }]);
  });
});
