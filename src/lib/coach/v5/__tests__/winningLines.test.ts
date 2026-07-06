import { describe, expect, it } from "vitest";
import { selectWinningLines } from "../winningLines";

const text = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("selectWinningLines — §3.5 rep-confirmed ranking + dedup + cap", () => {
  it("ranks rep_marked lines ABOVE inferred ones (Fix C)", () => {
    const outcomes = [
      { cue_id: "a", source: "inferred" },
      { cue_id: "b", source: "rep_marked" },
    ];
    const out = selectWinningLines(outcomes, text({ a: "inferred line", b: "confirmed line" }), 5);
    expect(out).toEqual(["confirmed line", "inferred line"]);
  });

  it("preserves input (recency) order WITHIN the rep_marked group (stable sort)", () => {
    const outcomes = [
      { cue_id: "x", source: "rep_marked" },
      { cue_id: "y", source: "rep_marked" },
      { cue_id: "z", source: "inferred" },
    ];
    const out = selectWinningLines(outcomes, text({ x: "first", y: "second", z: "third" }), 5);
    expect(out).toEqual(["first", "second", "third"]);
  });

  it("dedupes repeated cue ids and identical text", () => {
    const outcomes = [
      { cue_id: "a", source: "rep_marked" },
      { cue_id: "a", source: "rep_marked" }, // same id
      { cue_id: "b", source: "inferred" }, // different id, same text
    ];
    const out = selectWinningLines(outcomes, text({ a: "same words", b: "same words" }), 5);
    expect(out).toEqual(["same words"]);
  });

  it("caps at the limit (fills with the top-ranked first)", () => {
    const outcomes = [
      { cue_id: "a", source: "rep_marked" },
      { cue_id: "b", source: "rep_marked" },
      { cue_id: "c", source: "inferred" },
    ];
    const out = selectWinningLines(outcomes, text({ a: "one", b: "two", c: "three" }), 2);
    expect(out).toEqual(["one", "two"]);
  });

  it("skips cue ids with no text", () => {
    const outcomes = [
      { cue_id: "missing", source: "rep_marked" },
      { cue_id: "b", source: "rep_marked" },
    ];
    const out = selectWinningLines(outcomes, text({ b: "present" }), 5);
    expect(out).toEqual(["present"]);
  });

  it("truncates each line to maxLen", () => {
    const long = "x".repeat(300);
    const out = selectWinningLines([{ cue_id: "a", source: "rep_marked" }], text({ a: long }), 5, 140);
    expect(out[0]!.length).toBe(140);
  });

  it("empty input → empty", () => {
    expect(selectWinningLines([], new Map(), 5)).toEqual([]);
  });
});
