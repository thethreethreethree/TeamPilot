import { describe, it, expect } from "vitest";
import { MIN_GRADED, missRates, rankByNeeds } from "../repNeeds";

describe("rep needs", () => {
  const g = (elementId: string, ...grades: string[]) => grades.map((grade) => ({ elementId, grade }));
  it("a miss counts 1, a partial ½; an item needs MIN_GRADED grades; an item never missed is no need", () => {
    const r = missRates([...g("close", "missed", "missed", "partial", "hit"), ...g("rapport", "missed", "missed"), ...g("intro", "hit", "hit", "hit")]);
    expect(r.get("close")).toEqual({ elementId: "close", rate: 2.5 / 4, misses: 2, graded: 4 });
    expect(r.has("rapport")).toBe(false); // only 2 grades < MIN_GRADED
    expect(r.has("intro")).toBe(false);
    expect(MIN_GRADED).toBe(3);
  });
  it("scenarios are ordered by the weakest need they train; untagged keep their place after", () => {
    const needs = missRates([...g("close", "missed", "missed", "missed"), ...g("objection", "missed", "hit", "hit")]);
    const ranked = rankByNeeds([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], new Map([["b", ["objection"]], ["c", ["close", "objection"]], ["d", ["intro"]]]), needs);
    expect(ranked.map((s) => [s.id, s.need?.elementId ?? null])).toEqual([["c", "close"], ["b", "objection"], ["a", null], ["d", null]]);
  });
});
