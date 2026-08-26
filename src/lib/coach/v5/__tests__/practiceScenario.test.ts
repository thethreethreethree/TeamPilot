import { describe, it, expect } from "vitest";
import { parsePracticeScenario } from "../practiceScenario";

/**
 * parsePracticeScenario is the honesty seam for AI-written practice scenarios (§3.4): a malformed/empty generation
 * returns null so the caller falls back to the plain focus seed — never a fabricated or blank scenario.
 */
describe("parsePracticeScenario", () => {
  it("parses a valid scenario", () => {
    const s = parsePracticeScenario(
      JSON.stringify({ title: "The burned homeowner", persona: "Guarded homeowner, just home from work", situation: "They had a bad experience with a competitor last year and are short on time." }),
    );
    expect(s?.title).toBe("The burned homeowner");
    expect(s?.persona).toContain("Guarded homeowner");
    expect(s?.situation).toContain("bad experience");
  });

  it("tolerates a ```json fence", () => {
    const s = parsePracticeScenario("```json\n" + JSON.stringify({ title: "T", persona: "P", situation: "S" }) + "\n```");
    expect(s?.persona).toBe("P");
  });

  it("returns null on malformed / non-object JSON (fall back to the plain seed)", () => {
    expect(parsePracticeScenario("not json")).toBeNull();
    expect(parsePracticeScenario("")).toBeNull();
    expect(parsePracticeScenario("null")).toBeNull();
    expect(parsePracticeScenario("[1,2]")).toBeNull();
  });

  it("returns null when there is neither a persona nor a situation (nothing usable)", () => {
    expect(parsePracticeScenario(JSON.stringify({ title: "Just a title" }))).toBeNull();
  });

  it("keeps a scenario with only a situation (a missing title/persona is not fatal)", () => {
    const s = parsePracticeScenario(JSON.stringify({ situation: "A homeowner mid-argument with a spouse answers the door." }));
    expect(s).not.toBeNull();
    expect(s?.situation).toContain("homeowner");
    expect(s?.title).toBe("");
  });
});
