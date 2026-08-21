import { describe, it, expect, vi } from "vitest";
import { MeetingStrategy } from "../meeting/meetingStrategy";
import { HuddleStrategy } from "../huddle/huddleStrategy";
import type { CoachingContext, CueLLM, StrategyTranscriptSegment } from "../coachingStrategy";

/**
 * Orchestration contract for the MeetingStrategy / HuddleStrategy classes (the vocab/parse is covered
 * elsewhere). The invariants that matter for a LIVE call:
 *  - understanding gate: too little transcript → silent, and the LLM is NOT called (no wasted cost) — unless
 *    the wearer explicitly asked (force).
 *  - A40: a `suppressed` LLM verdict (control gate declined) → silent, WITHOUT parsing.
 *  - a valid response → the parsed cue.
 *  - NEVER throws: an LLM error resolves to stay-silent, never disrupts the call.
 * The LLM is dependency-injected, so these run with a fake — no network, no binding.
 */

const ctx = (over: Partial<CoachingContext> = {}): CoachingContext => ({
  sessionKind: "meeting",
  companyId: "co-1",
  mode: "suggestion",
  ...over,
});

const seg = (speaker: string, text: string, i: number): StrategyTranscriptSegment => ({
  speaker,
  text,
  seq: i,
});

const twoTurns: StrategyTranscriptSegment[] = [
  seg("Alex", "Let's talk about the launch date.", 0),
  seg("Dana", "I think we push it a week.", 1),
];

describe.each([
  ["MeetingStrategy", (llm: CueLLM) => new MeetingStrategy(llm), "decision_point", "undecided"],
  ["HuddleStrategy", (llm: CueLLM) => new HuddleStrategy(llm), "status_round", "vague_status"],
] as const)("%s orchestration", (_name, make, phase, trigger) => {
  it("stays silent and does NOT call the LLM when there's too little transcript", async () => {
    const llm = vi.fn();
    const d = await make(llm as unknown as CueLLM).analyze([seg("Alex", "hi", 0)], ctx());
    expect(d.shouldCue).toBe(false);
    expect(llm).not.toHaveBeenCalled();
  });

  it("bypasses the min-segments gate when forced (the wearer asked)", async () => {
    const llm = vi.fn(async () => ({ text: JSON.stringify({ phase, trigger, shouldCue: true, cue: "Do the thing." }) }));
    const d = await make(llm as unknown as CueLLM).analyze([seg("Alex", "hi", 0)], ctx({ force: true }));
    expect(llm).toHaveBeenCalledTimes(1);
    expect(d.shouldCue).toBe(true);
  });

  it("stays silent on a suppressed verdict WITHOUT parsing (A40)", async () => {
    const llm = vi.fn(async () => ({ text: JSON.stringify({ phase, trigger, shouldCue: true, cue: "should be ignored" }), suppressed: true }));
    const d = await make(llm as unknown as CueLLM).analyze(twoTurns, ctx());
    expect(d.shouldCue).toBe(false);
    expect(d.cue).toBeNull();
  });

  it("returns the parsed cue on a valid response", async () => {
    const llm = vi.fn(async () => ({
      text: JSON.stringify({ phase, trigger, shouldCue: true, importance: "high", cue: "Close it before moving on." }),
    }));
    const d = await make(llm as unknown as CueLLM).analyze(twoTurns, ctx());
    expect(d).toEqual({ shouldCue: true, cue: "Close it before moving on.", trigger, phase, importance: "high" });
  });

  it("an AUTO cue LLM error resolves to stay-silent (never disrupts a live call)", async () => {
    const llm = vi.fn(async () => {
      throw new Error("provider 500");
    });
    const d = await make(llm as unknown as CueLLM).analyze(twoTurns, ctx());
    expect(d.shouldCue).toBe(false);
    expect(d.cue).toBeNull();
  });

  it("RE-THROWS on a FORCED cue LLM error so the route surfaces it, not a false silence (finding A)", async () => {
    const llm = vi.fn(async () => {
      throw new Error("provider 500");
    });
    await expect(make(llm as unknown as CueLLM).analyze(twoTurns, ctx({ force: true }))).rejects.toThrow(/provider 500/);
  });

  it("DROPS an AUTO cue whose trigger is out-of-vocab / leaked from another domain (finding B — the leak gate)", async () => {
    // A sales 'close' cue must never ride into a meeting/huddle with a relabeled trigger.
    const llm = vi.fn(async () => ({
      text: JSON.stringify({ phase: "closing", trigger: "close", shouldCue: true, importance: "high", cue: "Ask them to sign now." }),
    }));
    const d = await make(llm as unknown as CueLLM).analyze(twoTurns, ctx());
    expect(d.shouldCue).toBe(false);
    expect(d.cue).toBeNull();
  });
});
