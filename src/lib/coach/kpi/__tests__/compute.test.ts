import { describe, it, expect } from "vitest";
import {
  MIN_SESSIONS,
  conversionRate,
  closeRate,
  revenue,
  avgDealSize,
  sessionsPerDay,
  avgSessionDurationMin,
  layer3Dimension,
  cueAcceptanceRate,
  relianceReductionSlope,
  baseline,
  sumDollarsExact,
  isOpportunity,
  type KpiSessionRow,
} from "../compute";

/**
 * KPI compute — the two load-bearing disciplines: the Understanding Gate (no number below MIN_SESSIONS)
 * and exact-decimal money (no float accumulation). Plus the Layer-1/2 metric math.
 */

const S = (o: KpiSessionRow["outcome"], deal: number | null, day: string, durMin = 30, i = 0): KpiSessionRow => ({
  outcome: o,
  dealValue: deal,
  startedAt: `${day}T10:00:00.000Z`,
  endedAt: durMin === 0 ? null : new Date(Date.parse(`${day}T10:00:00.000Z`) + durMin * 60000).toISOString(),
  sessionId: `${day}-${o}-${i}`,
});

describe("Understanding Gate (MIN_SESSIONS)", () => {
  it("gates conversionRate below MIN_SESSIONS opportunities (building, not a guess)", () => {
    const rows = Array.from({ length: MIN_SESSIONS - 1 }, (_, i) => S("sold", 100, "2026-07-01", 30, i));
    const r = conversionRate(rows);
    expect(r.value).toBeNull();
    expect(r.gated).toBe(true);
    expect(r.sampleSize).toBe(MIN_SESSIONS - 1);
  });

  it("no_contact + null are NOT opportunities (don't count toward the gate)", () => {
    expect(isOpportunity(S("no_contact", null, "2026-07-01"))).toBe(false);
    expect(isOpportunity(S(null, null, "2026-07-01"))).toBe(false);
    expect(isOpportunity(S("sold", 100, "2026-07-01"))).toBe(true);
  });

  it("activates conversionRate at exactly MIN_SESSIONS opportunities", () => {
    // 5 opportunities: 2 sold, 3 not → 40%
    const rows = [
      S("sold", 100, "2026-07-01", 30, 1),
      S("sold", 100, "2026-07-01", 30, 2),
      S("no_sale", null, "2026-07-01", 30, 3),
      S("follow_up", null, "2026-07-01", 30, 4),
      S("undecided", null, "2026-07-01", 30, 5),
    ];
    const r = conversionRate(rows);
    expect(r.gated).toBe(false);
    expect(r.value).toBe(40);
    expect(r.sourceSessionIds).toHaveLength(5);
  });
});

describe("Layer 1 math", () => {
  it("closeRate = won ÷ (won+lost), ignoring open/no-contact", () => {
    const rows = [
      S("sold", 100, "2026-07-01",30, 1),
      S("sold", 100, "2026-07-01",30, 2),
      S("sold", 100, "2026-07-01",30, 3),
      S("no_sale", null, "2026-07-01",30, 4),
      S("no_sale", null, "2026-07-01",30, 5),
      S("follow_up", null, "2026-07-01",30, 6), // excluded (not resolved)
      S("no_contact", null, "2026-07-01",30, 7), // excluded
    ];
    const r = closeRate(rows);
    expect(r.sampleSize).toBe(5); // only resolved
    expect(r.value).toBe(60); // 3/5
  });

  it("revenue + avgDealSize are EXACT-decimal (no float drift)", () => {
    // Values chosen so naive float sum drifts: 0.1+0.2 etc. scaled up.
    const vals = [10.1, 20.2, 30.3, 0.1, 0.2];
    const rows = vals.map((v, i) => S("sold", v, "2026-07-01",30, i));
    const rev = revenue(rows);
    expect(rev.value).toBe(60.9); // exact via cents; naive float would give 60.900000000000006
    const avg = avgDealSize(rows);
    expect(avg.value).toBe(12.18); // 60.9 / 5
  });

  it("revenue gates when < MIN_SESSIONS sold-with-value", () => {
    const rows = [S("sold", 100, "2026-07-01",30, 1), S("sold", 200, "2026-07-01",30, 2)];
    expect(revenue(rows).value).toBeNull();
  });
});

describe("Layer 2 math", () => {
  it("sessionsPerDay = count ÷ distinct days", () => {
    const rows = [
      S("sold", 100, "2026-07-01", 30, 1),
      S("sold", 100, "2026-07-01", 30, 2),
      S("no_sale", null, "2026-07-01", 30, 3),
      S("no_sale", null, "2026-07-02", 30, 4),
      S("follow_up", null, "2026-07-02", 30, 5),
    ];
    const r = sessionsPerDay(rows);
    expect(r.value).toBe(2.5); // 5 sessions ÷ 2 days
  });

  it("avgSessionDurationMin over ended sessions only", () => {
    const rows = [
      S("sold", 100, "2026-07-01",20, 1),
      S("sold", 100, "2026-07-01",40, 2),
      S("no_sale", null, "2026-07-01",30, 3),
      S("no_sale", null, "2026-07-01",30, 4),
      S("follow_up", null, "2026-07-01",30, 5),
      S("undecided", null, "2026-07-01",0, 6), // not ended → excluded
    ];
    const r = avgSessionDurationMin(rows);
    expect(r.sampleSize).toBe(5);
    expect(r.value).toBe(30); // (20+40+30+30+30)/5
  });
});

describe("baseline (self-comparison)", () => {
  it("computes mean + population stddev", () => {
    const b = baseline([10, 20, 30, 40, 50]);
    expect(b.mean).toBe(30);
    expect(b.stddev).toBe(14.14); // sqrt(200)
    expect(b.sampleSize).toBe(5);
  });
  it("empty history → null baseline (no fabricated mean)", () => {
    expect(baseline([])).toEqual({ mean: null, stddev: null, sampleSize: 0 });
  });
});

describe("Layer 3 (after-pitch score aggregation)", () => {
  const row = (sid: string, key: string, score: number, caveat = false) => ({
    sessionId: sid,
    scores: [{ key, score, caveat }],
  });

  it("averages a dimension and scales 0-10 to 0-100", () => {
    const rows = [
      row("1", "objection", 6),
      row("2", "objection", 8),
      row("3", "objection", 7),
      row("4", "objection", 5),
      row("5", "objection", 9),
    ];
    const r = layer3Dimension(rows, "objection");
    expect(r.gated).toBe(false);
    expect(r.value).toBe(70); // avg 7.0 → 70
    expect(r.sampleSize).toBe(5);
  });

  it("skips caveat scores (data-capture gaps, not behaviour)", () => {
    const rows = [
      row("1", "talk_ratio", 2, true), // caveat → excluded
      row("2", "talk_ratio", 8),
      row("3", "talk_ratio", 8),
      row("4", "talk_ratio", 8),
      row("5", "talk_ratio", 8),
      row("6", "talk_ratio", 8),
    ];
    const r = layer3Dimension(rows, "talk_ratio");
    expect(r.sampleSize).toBe(5); // the caveat one excluded
    expect(r.value).toBe(80);
  });

  it("gates below MIN_SESSIONS scored", () => {
    const rows = [row("1", "close", 7), row("2", "close", 7)];
    expect(layer3Dimension(rows, "close").value).toBeNull();
  });
});

describe("Layer 4 (coaching & growth)", () => {
  it("cueAcceptanceRate = acted ÷ delivered, gated below MIN_SESSIONS cues", () => {
    expect(cueAcceptanceRate([{ acted: true }, { acted: false }]).value).toBeNull(); // < 5
    const cues = [
      { acted: true },
      { acted: true },
      { acted: false },
      { acted: true },
      { acted: false },
    ];
    expect(cueAcceptanceRate(cues).value).toBe(60); // 3/5
  });

  it("relianceReductionSlope is NEGATIVE when cues-per-session decline (coaching working)", () => {
    const pts = [
      { order: 1, cueCount: 6, sessionId: "a" },
      { order: 2, cueCount: 5, sessionId: "b" },
      { order: 3, cueCount: 4, sessionId: "c" },
      { order: 4, cueCount: 3, sessionId: "d" },
      { order: 5, cueCount: 2, sessionId: "e" },
    ];
    const r = relianceReductionSlope(pts);
    expect(r.gated).toBe(false);
    expect(r.value).toBe(-1); // perfectly declining by 1/session
    expect(r.sourceSessionIds).toHaveLength(5);
  });

  it("relianceReductionSlope gates below MIN_SESSIONS", () => {
    expect(
      relianceReductionSlope([
        { order: 1, cueCount: 5, sessionId: "a" },
        { order: 2, cueCount: 4, sessionId: "b" },
      ]).value
    ).toBeNull();
  });
});

describe("sumDollarsExact", () => {
  it("does not drift on classic float cases", () => {
    expect(sumDollarsExact([0.1, 0.2])).toBe(0.3);
    expect(sumDollarsExact([19.99, 0.01])).toBe(20);
  });
});
