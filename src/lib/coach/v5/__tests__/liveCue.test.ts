import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * generateLiveCue's response parse is the core of live-cue DELIVERY: it turns the
 * cue LLM's raw text into { shouldCue, cue, importance } which the hook's delivery
 * gate then acts on. It was UNTESTED. The subtle, load-bearing rules — a real cue
 * with a missing importance defaults to "medium" (NOT suppressed by parser
 * accident), only an explicit "low" suppresses, and every failure path fails SAFE
 * to silent (never deliver garbage) — would break delivery silently if a refactor
 * changed them. These tests pin them. The LLM is mocked, so no production code
 * changes and the REAL parse is exercised.
 */
vi.mock("@/lib/claude", () => ({ liveSalesCue: vi.fn() }));
vi.mock("@/lib/data/salesCoach", () => ({
  getCurrentSalesCorpus: vi.fn(async () => null),
  getRepWinningLines: vi.fn(async () => []),
}));

import { liveSalesCue } from "@/lib/claude";
import { generateLiveCue } from "../liveCue";

const seg = (speaker: string, text: string) => ({ speaker, text }) as never;
const baseArgs = {
  companyId: "co1",
  // salesCoach.CueMode = "suggestion" | "guide_response" (the cue STYLE), not the
  // in_person/video modality (that's cueInstrument.CueMode — a same-named,
  // different type). generateLiveCue takes the salesCoach one. Only affects the
  // prompt, not the parse under test.
  mode: "suggestion" as const,
  segments: [
    seg("prospect", "I'm not sure about the price."),
    seg("agent", "Tell me more about your concern."),
  ],
};

function mockCue(text: string, suppressed = false) {
  vi.mocked(liveSalesCue).mockResolvedValue({ text, suppressed } as never);
}

describe("generateLiveCue — response parse + delivery fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a valid high-importance cue", async () => {
    mockCue(
      JSON.stringify({
        shouldCue: true,
        cue: "Acknowledge the price concern before answering it.",
        importance: "high",
        phase: "objection",
        trigger: "objection",
      })
    );
    const r = await generateLiveCue(baseArgs);
    expect(r.shouldCue).toBe(true);
    expect(r.cue).toBe("Acknowledge the price concern before answering it.");
    expect(r.importance).toBe("high");
  });

  it("defaults a REAL cue with no importance to 'medium' (never suppressed by parser accident)", async () => {
    mockCue(JSON.stringify({ shouldCue: true, cue: "Ask what budget they had in mind." }));
    const r = await generateLiveCue(baseArgs);
    expect(r.shouldCue).toBe(true);
    expect(r.importance).toBe("medium");
  });

  it("honours an explicit 'low' importance (these are what the gate suppresses)", async () => {
    mockCue(JSON.stringify({ shouldCue: true, cue: "Small: mirror their last word.", importance: "low" }));
    const r = await generateLiveCue(baseArgs);
    expect(r.importance).toBe("low");
  });

  it("stays silent on malformed JSON (never delivers garbage)", async () => {
    mockCue("this is not json");
    const r = await generateLiveCue(baseArgs);
    expect(r.shouldCue).toBe(false);
    expect(r.cue).toBe("");
  });

  it("stays silent when shouldCue is false, even with a cue string present", async () => {
    mockCue(JSON.stringify({ shouldCue: false, cue: "something the model wasn't sure about" }));
    const r = await generateLiveCue(baseArgs);
    expect(r.shouldCue).toBe(false);
    expect(r.cue).toBe("");
  });

  it("stays silent when the provider suppressed the call", async () => {
    vi.mocked(liveSalesCue).mockResolvedValue({ text: "", suppressed: true } as never);
    const r = await generateLiveCue(baseArgs);
    expect(r.shouldCue).toBe(false);
  });

  it("force delivers a non-empty cue even when shouldCue is false (the agent asked)", async () => {
    mockCue(JSON.stringify({ shouldCue: false, cue: "Name the next concrete step." }));
    const r = await generateLiveCue({ ...baseArgs, force: true });
    expect(r.shouldCue).toBe(true);
    expect(r.cue).toBe("Name the next concrete step.");
  });

  it("returns silent (no LLM call) when there isn't enough conversation to read", async () => {
    mockCue(JSON.stringify({ shouldCue: true, cue: "x", importance: "high" }));
    const r = await generateLiveCue({ ...baseArgs, segments: [seg("prospect", "hi")] });
    expect(r.shouldCue).toBe(false);
    expect(vi.mocked(liveSalesCue)).not.toHaveBeenCalled();
  });
});
