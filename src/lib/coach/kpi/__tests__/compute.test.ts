import { describe, it, expect } from "vitest";
import {
  MIN_SESSIONS,
  conversionRate,
  closeRate,
  revenue,
  avgDealSize,
  quotaAttainment,
  sessionsPerDay,
  avgSessionDurationMin,
  layer3Dimension,
  cueAcceptanceRate,
  cueToOutcomeCorrelation,
  relianceReductionSlope,
  relianceReductionFromFirstCue,
  overallSkillProgression,
  qualityConsistency,
  layer3Delta,
  selfDelta,
  isSlippingVsBaseline,
  ALERT_DROP_FRACTION,
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

  it("quotaAttainment = deals won ÷ target; gated (null) until a target is set; honest 0% with a target", () => {
    expect(quotaAttainment(6, null).value).toBeNull(); // no target → building
    expect(quotaAttainment(6, 10).value).toBe(60); // 6/10
    expect(quotaAttainment(0, 10).value).toBe(0); // honest 0%, not "building"
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

  it("layer3Delta = (recent-half − prior-half) of a dimension, scaled 0-100; gated below 2·MIN", () => {
    const rows = [
      row("1", "objection", 5), row("2", "objection", 5), row("3", "objection", 5),
      row("4", "objection", 5), row("5", "objection", 5), // prior avg 5
      row("6", "objection", 7), row("7", "objection", 7), row("8", "objection", 7),
      row("9", "objection", 7), row("10", "objection", 7), // recent avg 7
    ];
    expect(layer3Delta(rows, "objection")).toBe(20); // (7-5)*10
    expect(layer3Delta(rows.slice(0, 9), "objection")).toBeNull(); // < 10
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

  it("relianceReductionFromFirstCue drops leading observe-window/pre-coach 0-cue sessions", () => {
    // First 3 sessions are observe/pre-coach (0 cues); real coaching starts at session 4 with a declining trend.
    const pts = [
      { cueCount: 0, sessionId: "obs1" },
      { cueCount: 0, sessionId: "obs2" },
      { cueCount: 0, sessionId: "obs3" },
      { cueCount: 6, sessionId: "a" },
      { cueCount: 5, sessionId: "b" },
      { cueCount: 4, sessionId: "c" },
      { cueCount: 3, sessionId: "d" },
      { cueCount: 2, sessionId: "e" },
    ];
    const r = relianceReductionFromFirstCue(pts);
    expect(r.gated).toBe(false);
    expect(r.value).toBe(-1); // declining -1/session over the 5 cued-era sessions (observe run excluded)
    expect(r.sampleSize).toBe(5);
    expect(r.sourceSessionIds).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("relianceReductionFromFirstCue gates when the agent was never cued", () => {
    const r = relianceReductionFromFirstCue([
      { cueCount: 0, sessionId: "a" },
      { cueCount: 0, sessionId: "b" },
    ]);
    expect(r.value).toBeNull();
  });

  it("overallSkillProgression = (recent-half mean − prior-half mean) of quality, scaled 0-100", () => {
    const r = (sid: string, score: number) => ({ sessionId: sid, scores: [{ key: "objection", score }] });
    const rows = [
      r("1", 5), r("2", 5), r("3", 5), r("4", 5), r("5", 5), // prior avg 5
      r("6", 7), r("7", 7), r("8", 7), r("9", 7), r("10", 7), // recent avg 7
    ];
    const res = overallSkillProgression(rows);
    expect(res.gated).toBe(false);
    expect(res.value).toBe(20); // (7-5)*10
  });

  it("overallSkillProgression gates below 2·MIN_SESSIONS scored sessions", () => {
    const r = (sid: string) => ({ sessionId: sid, scores: [{ key: "close", score: 6 }] });
    expect(overallSkillProgression([r("1"), r("2"), r("3")]).value).toBeNull();
  });

  it("qualityConsistency = 100 when quality is perfectly steady; gated below MIN_SESSIONS", () => {
    const r = (sid: string, score: number) => ({ sessionId: sid, scores: [{ key: "objection", score }] });
    expect(qualityConsistency([r("1", 6), r("2", 6), r("3", 6), r("4", 6), r("5", 6)]).value).toBe(100);
    expect(qualityConsistency([r("1", 6), r("2", 6)]).value).toBeNull();
  });

  it("cueToOutcomeCorrelation is +1 when acting on cues perfectly tracks winning; gated below 2·MIN", () => {
    const s = (rate: number, won: boolean, id: string) => ({ actedRate: rate, won, sessionId: id });
    const perfect = [
      s(1, true, "1"), s(1, true, "2"), s(1, true, "3"), s(1, true, "4"), s(1, true, "5"),
      s(0, false, "6"), s(0, false, "7"), s(0, false, "8"), s(0, false, "9"), s(0, false, "10"),
    ];
    expect(cueToOutcomeCorrelation(perfect).value).toBe(1);
    expect(cueToOutcomeCorrelation(perfect.slice(0, 9)).value).toBeNull(); // < 10
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

describe("selfDelta (recent vs prior half)", () => {
  it("returns recent-half − prior-half once both halves clear the gate", () => {
    // 10 opportunities in time order: prior 5 = 1 sold (20%), recent 5 = 3 sold (60%) → delta +40.
    const prior = [
      S("sold", 100, "2026-07-01", 30, 1),
      S("no_sale", null, "2026-07-01", 30, 2),
      S("no_sale", null, "2026-07-01", 30, 3),
      S("follow_up", null, "2026-07-01", 30, 4),
      S("undecided", null, "2026-07-01", 30, 5),
    ];
    const recent = [
      S("sold", 100, "2026-07-02", 30, 6),
      S("sold", 100, "2026-07-02", 30, 7),
      S("sold", 100, "2026-07-02", 30, 8),
      S("no_sale", null, "2026-07-02", 30, 9),
      S("follow_up", null, "2026-07-02", 30, 10),
    ];
    expect(selfDelta([...prior, ...recent], conversionRate)).toBe(40);
  });

  it("is null below 2·MIN_SESSIONS (not enough to split honestly)", () => {
    const rows = Array.from({ length: 2 * 5 - 1 }, (_, i) => S("sold", 100, "2026-07-01", 30, i));
    expect(selfDelta(rows, conversionRate)).toBeNull();
  });
});

describe("isSlippingVsBaseline (manager exception alert)", () => {
  // 10 opportunities in time order; prior 5 vs recent 5. The alert = recent < prior × (1 − dropFraction).
  const priorHigh = [
    S("sold", 100, "2026-07-01", 30, 1),
    S("sold", 100, "2026-07-01", 30, 2),
    S("sold", 100, "2026-07-01", 30, 3),
    S("sold", 100, "2026-07-01", 30, 4),
    S("no_sale", null, "2026-07-01", 30, 5),
  ]; // prior conversion = 80%

  it("fires when recent conversion is ≥15% below the prior baseline", () => {
    const recentLow = [
      S("sold", 100, "2026-07-02", 30, 6),
      S("no_sale", null, "2026-07-02", 30, 7),
      S("no_sale", null, "2026-07-02", 30, 8),
      S("no_sale", null, "2026-07-02", 30, 9),
      S("no_sale", null, "2026-07-02", 30, 10),
    ]; // recent conversion = 20% < 80% × 0.85 = 68% → slipping
    expect(isSlippingVsBaseline([...priorHigh, ...recentLow], conversionRate)).toBe(true);
  });

  it("does NOT fire on a small dip within the threshold", () => {
    const recentSlight = [
      S("sold", 100, "2026-07-02", 30, 6),
      S("sold", 100, "2026-07-02", 30, 7),
      S("sold", 100, "2026-07-02", 30, 8),
      S("no_sale", null, "2026-07-02", 30, 9),
      S("no_sale", null, "2026-07-02", 30, 10),
    ]; // recent = 60%; 60% ≥ 80% × 0.85 = 68%? no → 60 < 68 so it WOULD fire; use a 70% recent instead
    // Recompute: to stay within threshold, recent must be ≥ 68%. 4/5 = 80% is no drop at all.
    const recentOk = [
      S("sold", 100, "2026-07-02", 30, 6),
      S("sold", 100, "2026-07-02", 30, 7),
      S("sold", 100, "2026-07-02", 30, 8),
      S("sold", 100, "2026-07-02", 30, 9),
      S("no_sale", null, "2026-07-02", 30, 10),
    ]; // recent = 80%, equal to prior → no drop
    expect(isSlippingVsBaseline([...priorHigh, ...recentOk], conversionRate)).toBe(false);
    // and the borderline "recentSlight" (60%) DOES trip it — a >15% relative drop:
    expect(isSlippingVsBaseline([...priorHigh, ...recentSlight], conversionRate)).toBe(true);
  });

  it("does not fire below 2·MIN_SESSIONS (not enough to split), nor on a zero prior baseline", () => {
    const thin = Array.from({ length: 2 * MIN_SESSIONS - 1 }, (_, i) => S("sold", 100, "2026-07-01", 30, i));
    expect(isSlippingVsBaseline(thin, conversionRate)).toBe(false);
    // Prior half all no_sale → prior conversion 0% → guarded (can't drop below zero).
    const zeroPrior = [
      ...Array.from({ length: MIN_SESSIONS }, (_, i) => S("no_sale", null, "2026-07-01", 30, i)),
      ...Array.from({ length: MIN_SESSIONS }, (_, i) => S("no_sale", null, "2026-07-02", 30, i + 100)),
    ];
    expect(isSlippingVsBaseline(zeroPrior, conversionRate)).toBe(false);
  });

  it("uses the founder-set 15% threshold by default", () => {
    expect(ALERT_DROP_FRACTION).toBe(0.15);
  });
});

describe("sumDollarsExact", () => {
  it("does not drift on classic float cases", () => {
    expect(sumDollarsExact([0.1, 0.2])).toBe(0.3);
    expect(sumDollarsExact([19.99, 0.01])).toBe(20);
  });
});
