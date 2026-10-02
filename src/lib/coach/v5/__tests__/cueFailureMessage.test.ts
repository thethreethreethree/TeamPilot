import { describe, it, expect } from "vitest";
import { cueFailureMessage } from "../cueFailureMessage";

/** The rep's cue-failure line (2026-10-02): plain words, never a console pointer, never "nothing to add". */
describe("cueFailureMessage", () => {
  it("uses the route's own sentence", () => {
    expect(cueFailureMessage(502, "Coach couldn't respond right now.")).toBe(
      "Coach couldn't respond right now. Ask again in a moment."
    );
  });

  it("falls back to our sentence, with the status, when the route sent none", () => {
    expect(cueFailureMessage(503, undefined)).toMatch(/couldn't respond right now \(503\)/);
    expect(cueFailureMessage(500, { message: "x" })).toMatch(/couldn't respond right now \(500\)/);
    expect(cueFailureMessage(500, "x".repeat(400))).toMatch(/couldn't respond right now \(500\)/);
  });

  it("a network failure asks the rep to check their connection", () => {
    expect(cueFailureMessage(null)).toMatch(/check your connection/i);
  });

  it("never points a rep at the console, and never claims the coach had nothing to add", () => {
    for (const m of [cueFailureMessage(502, "Coach couldn't respond right now."), cueFailureMessage(500), cueFailureMessage(null)]) {
      expect(m).not.toMatch(/console/i);
      expect(m).not.toMatch(/nothing to add/i);
    }
  });
});
