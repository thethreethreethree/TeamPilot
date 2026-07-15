import { describe, it, expect } from "vitest";
import {
  talkListenScore,
  speedScore,
  agentWpm,
  aggregateSkills,
  parseBreakdownLines,
  mergeBreakdowns,
  type SkillKey,
  type SkillScore,
} from "../skillAnalytics";
import type { ScoreCategory } from "../summaryTypes";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/** aggregateSkills always returns all six keys, so this find-or-throw keeps the
 *  assertions terse without tripping strict-undefined checks. */
function get(skills: SkillScore[], key: SkillKey): SkillScore {
  const s = skills.find((x) => x.key === key);
  if (!s) throw new Error(`missing skill ${key}`);
  return s;
}

/**
 * Pins the ELOSTATE Analytics scoring (spec p3, founder-confirmed balance-based).
 * The two non-obvious mappings — talk/listen and speed onto /10 — are the point:
 * both must PEAK AT HEALTHY, not at "more", and a missing metric must be null,
 * never 0 (§3.4 — "not measured yet" is not "you are terrible at this").
 */

function cat(key: string, score: number, display: string, extra?: Partial<ScoreCategory>): ScoreCategory {
  return { key: key as ScoreCategory["key"], label: key, score, display, rationale: "r", citation: null, computed: true, ...extra };
}
function seg(text: string, spokenAt: string | null): TranscriptSegment {
  return { speaker: "agent", text, spokenAt } as TranscriptSegment;
}

describe("talkListenScore — peaks at balance, not volume", () => {
  it("50/50 is a perfect 10", () => expect(talkListenScore(50)).toBe(10));
  it("100% talking scores 0 (the skill is listening, not volume)", () =>
    expect(talkListenScore(100)).toBe(0));
  it("75/25 is a middling 5", () => expect(talkListenScore(75)).toBe(5));
  it("is symmetric — 25% rep share also scores 5", () =>
    expect(talkListenScore(25)).toBe(talkListenScore(75)));
});

describe("speedScore — full marks inside the comfortable band", () => {
  it("130 wpm (mid-band) is a 10", () => expect(speedScore(130)).toBe(10));
  it("a racing 220 wpm scores low", () => expect(speedScore(220)).toBeLessThanOrEqual(3));
  it("a crawling 60 wpm scores low", () => expect(speedScore(60)).toBeLessThanOrEqual(5));
});

describe("agentWpm — honest null when timing is absent (§3.4)", () => {
  it("returns null when segments carry no timestamps", () => {
    expect(agentWpm([seg("one two three four five six seven eight", null)])).toBeNull();
  });
  it("computes wpm from timed agent speech", () => {
    // 120 words over 60s → 120 wpm
    const words = Array.from({ length: 120 }, () => "w").join(" ");
    const wpm = agentWpm([
      seg(words, "2026-07-15T10:00:00Z"),
      seg("done", "2026-07-15T10:01:00Z"),
    ]);
    expect(wpm).not.toBeNull();
    expect(Math.round(wpm as number)).toBeGreaterThan(100);
  });
});

describe("aggregateSkills — six skills, null not zero when unmeasured", () => {
  it("averages graded skills and maps the ratio/pace ones", () => {
    const perSession: ScoreCategory[][] = [
      [cat("talk_ratio", 5, "50 / 50"), cat("tone", 8, "8/10"), cat("close", 2, "2/10"), cat("question_rate", 4, "4 of 10")],
    ];
    const skills = aggregateSkills(perSession, [130]);
    expect(get(skills, "talk_listen").score).toBe(10); // 50/50
    expect(get(skills, "tone").score).toBe(8);
    expect(get(skills, "closing").score).toBe(2);
    expect(get(skills, "speed").score).toBe(10); // 130 wpm
    expect(get(skills, "questions").score).not.toBeNull();
  });

  it("a skill with no data is null, never 0", () => {
    const skills = aggregateSkills([[cat("tone", 7, "7/10")]], [null]);
    expect(get(skills, "tone").score).toBe(7);
    expect(get(skills, "speed").score).toBeNull(); // no timing → not "0/10"
    expect(get(skills, "closing").score).toBeNull();
    expect(get(skills, "talk_listen").score).toBeNull();
  });

  it("a one-sided (caveat) talk_ratio is excluded, not scored as a real ratio", () => {
    const skills = aggregateSkills([[cat("talk_ratio", 0, "—", { caveat: true })]], [null]);
    const talk = skills.find((s) => s.key === "talk_listen");
    expect(talk?.score).toBeNull();
  });
});

describe("mergeBreakdowns — the §3.4/§A24 honesty rule (never explain a number that doesn't exist)", () => {
  const s = (key: string, score: number | null): SkillScore => ({
    key: key as SkillScore["key"], label: key, score, sampleSize: 1,
    read: score === null ? "Not enough sessions yet to score this." : "band read",
  });

  it("a null-score skill keeps its deterministic read even if the LLM returned a line for it", () => {
    const lines = new Map([["speed", "You race — slow down."]]); // stray line for an unmeasured skill
    const out = mergeBreakdowns([s("speed", null)], lines);
    expect(out[0]!.breakdown).toBe("Not enough sessions yet to score this."); // NOT the LLM line
  });

  it("a scored skill uses its LLM line when present", () => {
    const out = mergeBreakdowns([s("closing", 2)], new Map([["closing", "Ask for the next step."]]));
    expect(out[0]!.breakdown).toBe("Ask for the next step.");
  });

  it("a scored skill with no LLM line falls back to its read", () => {
    const out = mergeBreakdowns([s("tone", 8)], new Map());
    expect(out[0]!.breakdown).toBe("band read");
  });
});

describe("parseBreakdownLines — degrade, never throw (§3.4)", () => {
  it("parses a well-formed response into a label→line map", () => {
    const m = parseBreakdownLines('{"lines":[{"label":"Tone","line":"Warm."}]}');
    expect(m.get("Tone")).toBe("Warm.");
  });
  it("returns an empty map on malformed JSON", () => {
    expect(parseBreakdownLines("not json").size).toBe(0);
  });
  it("returns an empty map when lines is missing or wrong-shaped", () => {
    expect(parseBreakdownLines('{"nope":1}').size).toBe(0);
    expect(parseBreakdownLines('{"lines":[{"label":"X"}]}').size).toBe(0); // no line
  });
});
