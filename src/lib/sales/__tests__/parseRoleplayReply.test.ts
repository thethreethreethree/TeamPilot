import { describe, it, expect } from "vitest";
import { parseRoleplayReply, prospectOnlyFallback } from "@/lib/sales/parseRoleplayReply";

describe("parseRoleplayReply", () => {
  it("parses clean JSON", () => {
    expect(parseRoleplayReply('{"prospect":"Go on.","cue":"Ask first."}')).toEqual({
      prospect: "Go on.",
      cue: "Ask first.",
    });
  });

  it("parses JSON wrapped in code fences", () => {
    const t = '```json\n{"prospect":"Fair.","cue":"Label it."}\n```';
    expect(parseRoleplayReply(t)).toEqual({ prospect: "Fair.", cue: "Label it." });
  });

  it("extracts the JSON block from surrounding prose", () => {
    const t = 'Sure, here: {"prospect":"Hmm.","cue":"Slow down."} hope that helps';
    expect(parseRoleplayReply(t)).toEqual({ prospect: "Hmm.", cue: "Slow down." });
  });

  it("returns null when there is no JSON object", () => {
    expect(parseRoleplayReply("Just a plain sentence, no braces.")).toBeNull();
  });

  it("returns null when prospect is missing (unusable)", () => {
    expect(parseRoleplayReply('{"cue":"Ask a question."}')).toBeNull();
  });

  it("tolerates a missing cue (prospect only)", () => {
    expect(parseRoleplayReply('{"prospect":"Alright."}')).toEqual({ prospect: "Alright.", cue: "" });
  });

  it("trims whitespace in both fields", () => {
    expect(parseRoleplayReply('{"prospect":"  A  ","cue":"  B  "}')).toEqual({ prospect: "A", cue: "B" });
  });
});

describe("prospectOnlyFallback (F2 — never leak the cue into the prospect line)", () => {
  it("strips a trailing 'cue:' section", () => {
    const t = "That's a fair point, tell me more.\ncue: Ask about their timeline.";
    expect(prospectOnlyFallback(t)).toBe("That's a fair point, tell me more.");
  });

  it("strips a trailing 'coach:' section", () => {
    const t = "I'm listening.\nCoach: Mirror the concern before pitching.";
    expect(prospectOnlyFallback(t)).toBe("I'm listening.");
  });

  it("strips a leading 'prospect:'/'dana:' speaker label", () => {
    expect(prospectOnlyFallback("Prospect: Go ahead.")).toBe("Go ahead.");
    expect(prospectOnlyFallback("Dana: You've got five minutes.")).toBe("You've got five minutes.");
  });

  it("passes a clean plain reply through", () => {
    expect(prospectOnlyFallback("Sure, what have you got?")).toBe("Sure, what have you got?");
  });

  it("falls back to a safe line when empty", () => {
    expect(prospectOnlyFallback("   ")).toBe("Sorry — say that again?");
  });
});
