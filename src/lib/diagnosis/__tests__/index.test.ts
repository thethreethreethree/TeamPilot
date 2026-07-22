import { describe, it, expect } from "vitest";
import { canAdvance, summarizeEvidence } from "../index";
import type { DiagnosisRun, RetrospectivePattern, CandidateResolution } from "../types";

/**
 * canAdvance is the constitution's Understanding-Gate discipline (§3.2 / §1.5) encoded as a pure function: the
 * diagnosis engine must REFUSE to advance a step until the evidence for that step exists. A regression that let
 * it advance early is precisely the "motion without understanding" failure the whole project exists to prevent,
 * so each hold condition gets an explicit guard. Untested until now.
 */

const baseRun = (o: Partial<DiagnosisRun> = {}): DiagnosisRun => ({
  id: "r1",
  startedAt: "2026-07-22T00:00:00Z",
  situation: "meetings run long",
  retrospective: [],
  outsideViews: [],
  problemHypothesis: null,
  gate: null,
  candidates: [],
  ...o,
});

const pattern = (over: Partial<RetrospectivePattern> = {}): RetrospectivePattern => ({
  description: "tasks slip past due",
  occurrences: 3,
  distinctSources: ["alice", "bob"],
  recurringSubjects: ["task:abc"],
  signalIds: ["sig1", "sig2", "sig3"],
  earliestObserved: "2026-06-01",
  latestObserved: "2026-07-01",
  ...over,
});

const hypothesis = { kind: "process", title: "handoffs", diagnosis: "no owner named at handoff" };
const candidate = (): CandidateResolution => ({
  action: "name an owner at each handoff",
  reasoning: "unowned work stalls",
  expectedOutcome: "fewer slips",
  predictedRipples: [],
});

describe("canAdvance — the Understanding-Gate discipline", () => {
  it("data and retrospective are always runnable (entry points)", () => {
    expect(canAdvance(baseRun(), "data").ok).toBe(true);
    expect(canAdvance(baseRun(), "retrospective").ok).toBe(true);
  });

  it("outsideView HOLDS when there is nothing to challenge", () => {
    expect(canAdvance(baseRun(), "outsideView").ok).toBe(false);
    // …but proceeds once there's a pattern OR a stated hypothesis
    expect(canAdvance(baseRun({ retrospective: [pattern()] }), "outsideView").ok).toBe(true);
    expect(canAdvance(baseRun({ problemHypothesis: hypothesis }), "outsideView").ok).toBe(true);
  });

  it("gate HOLDS without a stated hypothesis (§3.2 — cannot evaluate silence)", () => {
    expect(canAdvance(baseRun(), "gate").ok).toBe(false);
    expect(canAdvance(baseRun({ problemHypothesis: hypothesis }), "gate").ok).toBe(true);
  });

  it("rippleTrace HOLDS until the gate has PASSED (no tracing an unearned problem)", () => {
    expect(canAdvance(baseRun(), "rippleTrace").ok).toBe(false); // gate null
    expect(canAdvance(baseRun({ gate: { passes: false } as never }), "rippleTrace").ok).toBe(false);
    expect(canAdvance(baseRun({ gate: { passes: true } as never }), "rippleTrace").ok).toBe(true);
  });

  it("decide HOLDS with no candidate resolutions", () => {
    expect(canAdvance(baseRun(), "decide").ok).toBe(false);
    expect(canAdvance(baseRun({ candidates: [candidate()] }), "decide").ok).toBe(true);
  });

  it("close HOLDS until a resolution is chosen", () => {
    expect(canAdvance(baseRun(), "close").ok).toBe(false);
    expect(canAdvance(baseRun({ chosen: candidate() }), "close").ok).toBe(true);
  });

  it("a held step always carries a non-empty reason (informational, not a failure)", () => {
    const held = canAdvance(baseRun(), "gate");
    expect(held.ok).toBe(false);
    expect(held.reason.length).toBeGreaterThan(0);
  });
});

describe("summarizeEvidence", () => {
  it("is honest-empty when there are no patterns", () => {
    expect(summarizeEvidence([])).toBe("No patterns detected yet.");
  });

  it("formats each pattern with its occurrences, source count, and window", () => {
    const s = summarizeEvidence([pattern({ description: "tasks slip", occurrences: 5 })]);
    expect(s).toContain("tasks slip");
    expect(s).toContain("occurrences: 5");
    expect(s).toContain("sources: 2");
    expect(s).toContain("2026-06-01 → 2026-07-01");
  });
});
