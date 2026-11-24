import { describe, it, expect } from "vitest";
import { OUTCOME_TONE_CLASS, outcomeTone } from "../outcomeLabels";

/** F26.10 (founder 2026-11-25 "Green / grey / amber"): never red on a rep's call. */
describe("outcomeTone", () => {
  it("Sold green, No sale (and the door's Not interested) amber, everything else grey", () => {
    expect(outcomeTone("sold")).toBe("positive");
    expect(outcomeTone("no_sale")).toBe("caution");
    expect(outcomeTone("not_interested")).toBe("caution");
    for (const o of ["follow_up", "no_contact", "undecided", "no_answer", null, "made_up"]) expect(outcomeTone(o)).toBe("neutral");
  });
  it("no red anywhere", () => {
    expect(Object.values(OUTCOME_TONE_CLASS).join(" ")).not.toMatch(/red|rose/);
  });
});
