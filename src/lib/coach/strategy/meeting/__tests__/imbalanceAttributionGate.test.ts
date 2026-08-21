import { describe, it, expect } from "vitest";
import { MeetingStrategy } from "../meetingStrategy";
import type { CoachingContext, CueLLM, StrategyTranscriptSegment } from "../../coachingStrategy";

/**
 * A30/A39 code gate: the meeting `imbalance` trigger ("one person is dominating → bring others in") is
 * ungrounded without ≥2 distinct KNOWN speakers — on an unattributed window the coach cannot know WHO is quiet,
 * so a "bring others in" cue would be a confident guess (A39). The prompt tells the model to stay silent, but a
 * prompt is not a guarantee — this gate enforces it in CODE, so a model that emits imbalance anyway is suppressed.
 */
const ctx: CoachingContext = { sessionKind: "meeting", companyId: "co", mode: "suggestion" };

// A model that WANTS to fire an imbalance cue regardless of attribution.
const imbalanceLLM: CueLLM = async () => ({
  text: JSON.stringify({ phase: "discussion", trigger: "imbalance", shouldCue: true, cue: "Bring the others in." }),
});

const seg = (speaker: string, i: number): StrategyTranscriptSegment => ({ speaker, text: `line ${i}`, seq: i });

describe("MeetingStrategy — imbalance attribution gate", () => {
  it("SUPPRESSES imbalance when the window is unattributed (all UNKNOWN)", async () => {
    const d = await new MeetingStrategy(imbalanceLLM).analyze([seg("unknown", 0), seg("unknown", 1)], ctx);
    expect(d.shouldCue).toBe(false);
  });

  it("SUPPRESSES imbalance when only one distinct speaker is known", async () => {
    const d = await new MeetingStrategy(imbalanceLLM).analyze([seg("Alex", 0), seg("Alex", 1)], ctx);
    expect(d.shouldCue).toBe(false);
  });

  it("ALLOWS imbalance when ≥2 distinct speakers are known (attribution is real)", async () => {
    const d = await new MeetingStrategy(imbalanceLLM).analyze([seg("Alex", 0), seg("Dana", 1)], ctx);
    expect(d.shouldCue).toBe(true);
    expect(d.trigger).toBe("imbalance");
  });

  it("does NOT suppress a non-imbalance cue on an unattributed window", async () => {
    const undecidedLLM: CueLLM = async () => ({
      text: JSON.stringify({ phase: "decision_point", trigger: "undecided", shouldCue: true, cue: "Close the decision." }),
    });
    const d = await new MeetingStrategy(undecidedLLM).analyze([seg("unknown", 0), seg("unknown", 1)], ctx);
    expect(d.shouldCue).toBe(true);
    expect(d.trigger).toBe("undecided");
  });
});
