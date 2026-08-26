import { describe, it, expect } from "vitest";
import { parseCoachingMaterial } from "../coachingMaterial";

/**
 * parseCoachingMaterial is the honesty seam for the coaching-materials library (§3.4): a malformed/empty response
 * returns null so the caller shows an honest "couldn't load" state, never a fabricated guide.
 */
describe("parseCoachingMaterial", () => {
  it("parses a full guide and caps the arrays", () => {
    const m = parseCoachingMaterial(
      JSON.stringify({
        overview: "Handling price early keeps the door open.",
        keyMoves: ["Name value first", "Ask what they compare against", "Anchor to outcome", "Offer a small next step", "extra"],
        watchOuts: ["Defending the price", "another", "third", "fourth"],
        exampleLines: ["What would make this worth it to you?", "b", "c", "d"],
      }),
    );
    expect(m?.overview).toContain("price");
    expect(m?.keyMoves).toHaveLength(4); // capped
    expect(m?.watchOuts).toHaveLength(3);
    expect(m?.exampleLines).toHaveLength(3);
  });

  it("tolerates a ```json fence", () => {
    const m = parseCoachingMaterial("```json\n" + JSON.stringify({ overview: "O", keyMoves: ["k"], watchOuts: [], exampleLines: [] }) + "\n```");
    expect(m?.overview).toBe("O");
  });

  it("returns null on malformed / non-object / empty JSON", () => {
    expect(parseCoachingMaterial("not json")).toBeNull();
    expect(parseCoachingMaterial("")).toBeNull();
    expect(parseCoachingMaterial("null")).toBeNull();
    expect(parseCoachingMaterial("[1]")).toBeNull();
  });

  it("returns null when there is no overview, no keyMoves, and no exampleLines (nothing teachable)", () => {
    expect(parseCoachingMaterial(JSON.stringify({ watchOuts: ["only a warning"] }))).toBeNull();
  });

  it("keeps a guide that has key moves even with an empty overview", () => {
    const m = parseCoachingMaterial(JSON.stringify({ overview: "", keyMoves: ["Lead with a question"], watchOuts: [], exampleLines: [] }));
    expect(m).not.toBeNull();
    expect(m?.keyMoves).toEqual(["Lead with a question"]);
  });
});
