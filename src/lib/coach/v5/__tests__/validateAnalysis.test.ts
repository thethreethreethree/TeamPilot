import { describe, it, expect } from "vitest";
import { validateCoachAnalysis } from "../validateAnalysis";

/**
 * The shared Coach-analysis validator gates what BOTH the in-app ask-coach route and the browser-extension coach
 * endpoint return — the LLM's JSON is never trusted. This pins its branches directly (the route tests only
 * exercise a couple): a malformed improvement/principle must fail CLOSED (→ null → the route 502s), and the
 * optional/bounded fields (affirmation cap, starters cap+slice, secondaryPrinciple) must be enforced exactly, so
 * a model that over-runs a length or omits a required field can't leak a half-formed coaching card to the user.
 */

const base = {
  classification: "correct",
  needsImprovement: false,
  conversationStarters: [],
};

const fullImprovement = {
  classification: "unclear",
  needsImprovement: true,
  conversationStarters: ["Try leading with the answer?"],
  improvement: {
    suggestedRevision: "Your refund is approved and will land within 5 business days.",
    whyContext: "The customer asked a direct yes/no; leading with it lowers their anxiety.",
    whySentence: "Made to Stick — concrete, immediate answers stick.",
    principleCited: { name: "Lead with the answer", book: "Made to Stick", sectionRef: "§Concrete" },
  },
};

describe("validateCoachAnalysis — trust nothing from the model", () => {
  it("accepts a minimal valid no-improvement response", () => {
    const r = validateCoachAnalysis({ ...base });
    expect(r).not.toBeNull();
    expect(r!.classification).toBe("correct");
    expect(r!.needsImprovement).toBe(false);
  });

  it("rejects a non-object / null / unknown classification", () => {
    expect(validateCoachAnalysis(null)).toBeNull();
    expect(validateCoachAnalysis("nope")).toBeNull();
    expect(validateCoachAnalysis({ ...base, classification: "bogus" })).toBeNull();
  });

  it("rejects a non-boolean needsImprovement or non-array starters", () => {
    expect(validateCoachAnalysis({ ...base, needsImprovement: "yes" })).toBeNull();
    expect(validateCoachAnalysis({ ...base, conversationStarters: "x" })).toBeNull();
  });

  it("accepts a full improvement + preserves the cited principle", () => {
    const r = validateCoachAnalysis(fullImprovement);
    expect(r).not.toBeNull();
    expect(r!.improvement?.principleCited.book).toBe("Made to Stick");
    expect(r!.improvement?.suggestedRevision).toContain("5 business days");
  });

  it("fails CLOSED when needsImprovement is true but improvement is missing/!object", () => {
    expect(validateCoachAnalysis({ ...base, needsImprovement: true })).toBeNull();
    expect(validateCoachAnalysis({ ...base, needsImprovement: true, improvement: "x" })).toBeNull();
  });

  it("rejects an improvement missing a required principleCited field", () => {
    const bad = {
      ...fullImprovement,
      improvement: { ...fullImprovement.improvement, principleCited: { name: "x", book: "y" } }, // no sectionRef
    };
    expect(validateCoachAnalysis(bad)).toBeNull();
  });

  it("rejects an over-long suggestedRevision (>4000) — a runaway can't reach the user", () => {
    const bad = {
      ...fullImprovement,
      improvement: { ...fullImprovement.improvement, suggestedRevision: "x".repeat(4001) },
    };
    expect(validateCoachAnalysis(bad)).toBeNull();
  });

  it("rejects an empty whyContext / whySentence (required, non-empty)", () => {
    expect(
      validateCoachAnalysis({
        ...fullImprovement,
        improvement: { ...fullImprovement.improvement, whyContext: "" },
      })
    ).toBeNull();
  });

  it("includes a well-formed secondaryPrinciple, and silently drops a malformed one", () => {
    const withGood = {
      ...fullImprovement,
      improvement: {
        ...fullImprovement.improvement,
        secondaryPrinciple: { name: "Mirror", book: "Never Split the Difference", sectionRef: "§Tactical" },
      },
    };
    expect(validateCoachAnalysis(withGood)!.improvement?.secondaryPrinciple?.name).toBe("Mirror");

    const withBad = {
      ...fullImprovement,
      improvement: { ...fullImprovement.improvement, secondaryPrinciple: { name: "Mirror" } }, // missing fields
    };
    const r = validateCoachAnalysis(withBad);
    expect(r).not.toBeNull(); // a bad SECONDARY doesn't fail the whole response — it's just dropped
    expect(r!.improvement?.secondaryPrinciple).toBeUndefined();
  });

  it("caps affirmation length (drops one >600) and filters + slices starters to 3", () => {
    const r = validateCoachAnalysis({
      classification: "correct",
      needsImprovement: false,
      affirmation: "a".repeat(601), // over cap → dropped
      conversationStarters: ["one", "", "x".repeat(201), "two", "three", "four"], // empty + over-200 filtered
    });
    expect(r!.affirmation).toBeUndefined();
    expect(r!.conversationStarters).toEqual(["one", "two", "three"]); // filtered then sliced to 3
  });
});
