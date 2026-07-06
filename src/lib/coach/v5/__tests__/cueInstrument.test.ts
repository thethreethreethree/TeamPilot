import { describe, expect, it } from "vitest";
import {
  computeCueLatency,
  formatCueMetric,
  summarizeCues,
  type CueTrace,
} from "../cueInstrument";

const trace = (over: Partial<CueTrace> = {}): CueTrace => ({
  triggeredAt: 1000,
  llmStartedAt: 1050,
  llmEndedAt: 1600,
  deliveredAt: 1680,
  importance: "high",
  phase: "objection",
  trigger: "objection",
  delivered: true,
  mode: "in_person",
  ...over,
});

describe("computeCueLatency", () => {
  it("derives queue/llm/tts/total from the perf marks", () => {
    expect(computeCueLatency(trace())).toEqual({
      queueMs: 50, // 1050 - 1000
      llmMs: 550, // 1600 - 1050
      ttsMs: 80, // 1680 - 1600
      totalMs: 680, // 1680 - 1000 (the end-to-end the agent feels)
    });
  });

  it("returns null for stages not yet reached (no crash on partial traces)", () => {
    const l = computeCueLatency(trace({ llmEndedAt: undefined, deliveredAt: undefined }));
    expect(l.queueMs).toBe(50);
    expect(l.llmMs).toBeNull();
    expect(l.totalMs).toBeNull();
  });

  it("guards against negative (clock skew / out-of-order marks) → null", () => {
    expect(computeCueLatency(trace({ deliveredAt: 900 })).totalMs).toBeNull();
  });
});

describe("formatCueMetric", () => {
  it("formats a delivered cue with its end-to-end total", () => {
    const s = formatCueMetric(trace());
    expect(s).toContain("DELIVERED total=680ms");
    expect(s).toContain("llm=550ms");
    expect(s).toContain("importance=high");
    expect(s).toContain("mode=in_person");
  });

  it("formats a suppressed cue with the reason, not a total", () => {
    const s = formatCueMetric(
      trace({ delivered: false, suppressReason: "out-ranked", deliveredAt: undefined })
    );
    expect(s).toContain("suppressed(out-ranked)");
    expect(s).not.toContain("DELIVERED");
  });
});

describe("summarizeCues", () => {
  it("counts delivered vs suppressed and reports median/p90 end-to-end", () => {
    const traces = [
      trace({ triggeredAt: 0, deliveredAt: 500 }), // 500
      trace({ triggeredAt: 0, deliveredAt: 900 }), // 900
      trace({ triggeredAt: 0, deliveredAt: 1300 }), // 1300
      trace({ delivered: false, suppressReason: "gate", deliveredAt: undefined }),
    ];
    const s = summarizeCues(traces);
    expect(s.delivered).toBe(3);
    expect(s.suppressed).toBe(1);
    expect(s.medianTotalMs).toBe(900);
    expect(s.p90TotalMs).toBe(1300);
  });

  it("handles an empty / all-suppressed session without NaN", () => {
    expect(summarizeCues([]).medianTotalMs).toBeNull();
    expect(
      summarizeCues([trace({ delivered: false, deliveredAt: undefined })]).medianTotalMs
    ).toBeNull();
  });
});
