import { describe, it, expect } from "vitest";
import { cleanExamples, parseSmartHits, smartPrompt, type Line, type SmartTracker } from "../smartTrackers";

const T: SmartTracker[] = [
  { id: "t1", name: "Locked in", examples: ["we're locked into a contract", "our deal doesn't end till June"], side: "customer" },
  { id: "t2", name: "Asks for the order", examples: ["shall we get you set up today"], side: "rep" },
];
const L: Line[] = [
  { seq: 1, speaker: "rep", text: "How's your current service?" },
  { seq: 2, speaker: "customer", text: "We signed for two years last spring, can't switch." },
  { seq: 3, speaker: "rep", text: "Want me to put the order in now?" },
];

describe("smart trackers", () => {
  it("examples: trimmed, de-duplicated, 1–10, each 5–200 characters", () => {
    expect(cleanExamples(["  we're locked in  ", "we're locked in"])).toEqual(["we're locked in"]);
    expect(() => cleanExamples([])).toThrow();
    expect(() => cleanExamples(["hi"])).toThrow();
    expect(() => cleanExamples(Array.from({ length: 11 }, (_, i) => `example number ${i}`))).toThrow();
  });
  it("the prompt lists every tracker with its side and examples, and numbered lines", () => {
    const p = smartPrompt(T, L);
    expect(p).toContain('T1 "Locked in" (side: customer)');
    expect(p).toContain("E2: our deal doesn't end till June");
    expect(p).toContain("[2] Customer: We signed for two years");
  });
  it("keeps only real lines, on the tracker's side, once each; bad JSON is null", () => {
    const raw = JSON.stringify({ hits: [
      { tracker: 1, line: 2, example: 1 },
      { tracker: 1, line: 2, example: 2 }, // same line again
      { tracker: 1, line: 3, example: 1 }, // a rep line for a customer tracker
      { tracker: 2, line: 3, example: 1 },
      { tracker: 3, line: 1 }, // no such tracker
      { tracker: 2, line: 99 }, // no such line
    ] });
    expect(parseSmartHits(raw, T, L)).toEqual([
      { trackerId: "t1", seq: 2, speaker: "customer", example: "we're locked into a contract" },
      { trackerId: "t2", seq: 3, speaker: "rep", example: "shall we get you set up today" },
    ]);
    expect(parseSmartHits("sorry", T, L)).toBeNull();
  });
});
