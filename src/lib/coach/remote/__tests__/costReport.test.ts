import { describe, it, expect } from "vitest";
import { costReport, type LedgerRow } from "../costReport";
import type { Price } from "../cost";

const at = new Date("2026-11-14T10:00:00Z");
const row = (over: Partial<LedgerRow>): LedgerRow => ({
  provider: "deepseek",
  model: "m",
  inputTokens: 1000,
  outputTokens: 100,
  audioSeconds: 0,
  at,
  companyId: "co1",
  sessionId: "s1",
  engine: "pitch_score",
  ...over,
});
const prices: Price[] = [
  { provider: "deepseek", model: "m", unit: "input_token", usdPerUnit: 0.000001, effectiveFrom: new Date("2026-01-01") },
  { provider: "deepseek", model: "m", unit: "output_token", usdPerUnit: 0.00001, effectiveFrom: new Date("2026-01-01") },
];

describe("costReport", () => {
  it("prices and groups by session, company and engine", () => {
    const r = costReport([row({}), row({ sessionId: "s2" }), row({ sessionId: null, engine: "chat_guide" })], prices);
    expect(r.calls).toBe(3);
    expect(r.unpricedCalls).toBe(0);
    expect(r.pricedUsd).toBeCloseTo(0.006, 9); // 3 × (0.001 + 0.001)
    expect(r.sessions.map((s) => s.key).sort()).toEqual(["s1", "s2"]); // the unattributed call is not a session
    expect(r.sessions.find((s) => s.key === "s1")!.usd).toBeCloseTo(0.002, 9);
    expect(r.companies).toHaveLength(1);
    expect(r.companies[0]!.calls).toBe(3);
    expect(r.engines.map((e) => e.key).sort()).toEqual(["chat_guide", "pitch_score"]);
  });

  it("a group with any unpriced call shows null (missing), never a partial sum", () => {
    const r = costReport([row({}), row({ model: "new-model" })], prices);
    const s1 = r.sessions.find((s) => s.key === "s1")!;
    expect(s1.usd).toBeNull();
    expect(s1.missing.sort()).toEqual(["input_token", "output_token"]);
    expect(r.unpricedCalls).toBe(1);
    expect(r.pricedUsd).toBeCloseTo(0.002, 9); // only what is known
    expect(r.missingPrices).toEqual([
      { provider: "deepseek", model: "new-model", unit: "input_token" },
      { provider: "deepseek", model: "new-model", unit: "output_token" },
    ]);
  });

  it("with no prices entered at all, nothing is costed and every price is listed as missing", () => {
    const r = costReport([row({})], []);
    expect(r.pricedUsd).toBe(0);
    expect(r.unpricedCalls).toBe(1);
    expect(r.companies[0]!.usd).toBeNull();
  });

  it("calls with no company are their own group, not merged into a tenant", () => {
    const r = costReport([row({}), row({ companyId: null, sessionId: null })], prices);
    expect(r.companies.map((c) => c.key).sort((a, b) => String(a).localeCompare(String(b)))).toEqual(["co1", null]);
  });
});
