import { describe, expect, it } from "vitest";
import {
  detectBlameProjection,
  detectEmotionalEscalation,
  detectHotState,
  detectAggressiveLanguage,
} from "../heuristics";

/**
 * The four communication-pattern detectors that heuristics.test.ts didn't cover.
 * Each is a pure text -> CoachCitation|null and gates whether the coach nudges,
 * so a miss (no coaching when warranted) or misfire (coaching neutral text) both
 * matter. Positive cases use phrasings the detectors' own docs cite; each has a
 * neutral negative so we're testing discrimination, not just firing.
 */
const NEUTRAL = "Can we sync on the deploy plan tomorrow morning?";

describe("detectBlameProjection", () => {
  it("fires when the message locates the cause in another person", () => {
    expect(detectBlameProjection("honestly it's your fault the deploy broke")?.id).toBe(
      "coach-blame-projection"
    );
    expect(detectBlameProjection("you're the reason we missed the deadline")).not.toBeNull();
  });
  it("stays silent on neutral collaboration", () => {
    expect(detectBlameProjection(NEUTRAL)).toBeNull();
  });
});

describe("detectHotState", () => {
  it("fires on composing-while-depleted tells", () => {
    expect(detectHotState("I've been up all night and this is still broken")?.id).toBe(
      "coach-hot-state"
    );
    expect(detectHotState("running on fumes here but sending anyway")).not.toBeNull();
  });
  it("stays silent on neutral collaboration", () => {
    expect(detectHotState(NEUTRAL)).toBeNull();
  });
});

describe("detectEmotionalEscalation", () => {
  it("fires on catastrophizing / high-intensity framing", () => {
    expect(detectEmotionalEscalation("this is a complete disaster")?.id).toBe(
      "coach-emotional-escalation"
    );
  });
  it("stays silent on neutral collaboration", () => {
    expect(detectEmotionalEscalation(NEUTRAL)).toBeNull();
  });
});

describe("detectAggressiveLanguage", () => {
  it("fires on aggression aimed at a person", () => {
    expect(detectAggressiveLanguage("just shut up and fix it")?.id).toBe(
      "coach-aggressive-language"
    );
  });
  it("stays silent on neutral collaboration", () => {
    expect(detectAggressiveLanguage(NEUTRAL)).toBeNull();
  });
});
