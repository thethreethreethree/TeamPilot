import { describe, it, expect } from "vitest";
import { computeMarket, MIN_CLOSED, topicGrouper, topicKey, type MarketCall, callsNaming } from "../market";

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
    expect(m.topics).toEqual([{ name: "Price", calls: 12, variants: [] }, { name: "Install date", calls: 6, variants: [] }]);
  });
});

describe("topicKey — merges wording, never meaning (production labels, 2026-11-23)", () => {
  const same = (a: string, b: string) => expect(topicKey(a)).toBe(topicKey(b));
  const apart = (a: string, b: string) => expect(topicKey(a)).not.toBe(topicKey(b));
  it("merges word order, small words, plurals and -ing/-ed forms", () => {
    same("internet and tv bundle", "tv and internet bundle");
    same("internet and tv bundle", "bundled internet and tv");
    same("internet and tv bundle", "internet and TV bundling");
    same("pricing", "price");
    same("internet speed", "internet speeds");
    same("throwing the game", "throwing a game");
    same("work-from-home and zoom usage", "work-from-home/zoom usage");
    same("fiber vs copper", "copper vs fiber");
  });
  it("keeps different topics apart", () => {
    apart("price increase", "pricing");
    apart("monthly bill", "monthly price");
    apart("internet speed", "internet speed test");
    apart("hbo", "hbo add-on");
    apart("installation", "installation deposit");
    expect(topicKey("speed")).toBe("speed"); // -eed is not an -ed ending
  });
  it("a grouped topic is named by its most used wording and lists the others", () => {
    const calls = ["a", "b", "c", "d"].map((id) => ({ sessionId: id, startedAt: "2026-11-10T10:00:00Z", outcome: null }));
    const intel = new Map([
      ["a", { competitors: [], topics: ["internet and tv bundle"] }],
      ["b", { competitors: [], topics: ["internet and tv bundle", "TV and internet bundle"] }],
      ["c", { competitors: [], topics: ["bundled internet and tv"] }],
      ["d", { competitors: [], topics: ["price increase"] }],
    ]);
    expect(computeMarket(calls, intel).topics).toEqual([
      { name: "internet and tv bundle", calls: 3, variants: ["bundled internet and tv", "tv and internet bundle"] },
      { name: "price increase", calls: 1, variants: [] },
    ]);
  });
});

describe("topic groups (0319)", () => {
  const calls = ["a", "b", "c"].map((id) => ({ sessionId: id, startedAt: "2026-11-10T10:00:00Z", outcome: null }));
  const intel = new Map([
    ["a", { competitors: [], topics: ["pricing", "monthly price"] }],
    ["b", { competitors: [], topics: ["monthly bill amount"] }],
    ["c", { competitors: [], topics: ["price increase"] }],
  ]);
  it("a manager's group counts its wordings together, once per call, under the manager's name", () => {
    const m = computeMarket(calls, intel, 15, [{ id: "g", name: "Price", members: ["pricing", "monthly prices", "monthly bill amount"] }]);
    expect(m.topics).toEqual([
      { name: "Price", calls: 2, variants: ["monthly bill amount", "monthly price", "pricing"], groupId: "g" },
      { name: "price increase", calls: 1, variants: [] },
    ]);
  });
  it("a wording in two groups goes to the newer (first) one", () => {
    const g = topicGrouper([{ id: "new", name: "N", members: ["pricing", "a"] }, { id: "old", name: "O", members: ["price", "b"] }]);
    expect(g.groupOf("Pricing")?.id).toBe("new");
  });
});

describe("callsNaming (E14 battlecards)", () => {
  it("the calls that named a competitor in any wording the page groups, newest first, capped", () => {
    const calls = [{ sessionId: "a", startedAt: "2026-11-01", outcome: null }, { sessionId: "b", startedAt: "2026-11-03", outcome: null }, { sessionId: "c", startedAt: "2026-11-02", outcome: null }];
    const intel = new Map([["a", { competitors: ["Spectrum"], topics: [] }], ["b", { competitors: [" spectrum  "], topics: [] }], ["c", { competitors: ["Comcast"], topics: [] }]]);
    expect(callsNaming(calls, intel, "SPECTRUM").map((c) => c.sessionId)).toEqual(["b", "a"]);
    expect(callsNaming(calls, intel, "Spectrum", 1).map((c) => c.sessionId)).toEqual(["b"]);
    expect(callsNaming(calls, intel, "  ")).toEqual([]);
  });
});
