import { describe, it, expect } from "vitest";
import { looseKey, nearMatches } from "../accountMatch";

/** Near-duplicate accounts are suggested, never merged (revenue plan: legal suffixes aren't stripped on create). */
describe("near matches", () => {
  it("a legal suffix, case and punctuation don't separate names; a different word does", () => {
    expect(looseKey("Acme, Inc.")).toBe(looseKey("acme"));
    expect(looseKey("Café Union LLC")).toBe("cafe union");
    expect(looseKey("Acme Robotics")).not.toBe(looseKey("Acme"));
  });
  it("groups only accounts that collide; a lone account isn't a suggestion", () => {
    const g = nearMatches([{ id: "1", name: "Acme" }, { id: "2", name: "ACME Inc" }, { id: "3", name: "Globex" }]);
    expect(g.map((x) => x.map((a) => a.id))).toEqual([["1", "2"]]);
    expect(nearMatches([{ id: "3", name: "Globex" }])).toEqual([]);
  });
});
