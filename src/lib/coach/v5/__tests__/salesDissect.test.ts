import { describe, expect, it } from "vitest";
import { parseDissect } from "../salesDissect";

const strength = (point: string) => ({ point, example: "e", why: "w" });
const growth = (opportunity: string, nextStep = "step") => ({
  opportunity,
  nextStep,
  why: "w",
});

/**
 * parseDissect guards the post-call dissect with the same structural tone law as
 * the review, plus "a growth area must carry both an opportunity AND a next
 * step" (no dangling critique).
 */
describe("parseDissect — tone law + complete growth areas", () => {
  it("HEADLINE: growth areas but NO strengths → no signal (tone-law guard)", () => {
    const out = parseDissect(
      JSON.stringify({ strengths: [], growthAreas: [growth("slow the close")] })
    );
    expect(out).toEqual({
      hasSignal: false,
      strengths: [],
      growthAreas: [],
      standoutStrategy: null,
    });
  });

  it("a dissect with a strength has signal", () => {
    const out = parseDissect(
      JSON.stringify({
        strengths: [strength("great discovery")],
        growthAreas: [growth("ask for the sale sooner")],
        overall: "solid call",
      })
    );
    expect(out!.hasSignal).toBe(true);
    expect(out!.strengths).toHaveLength(1);
    expect(out!.overall).toBe("solid call");
  });

  it("DROPS a growth area missing its nextStep (no dangling critique)", () => {
    const out = parseDissect(
      JSON.stringify({
        strengths: [strength("x")],
        growthAreas: [growth("vague concern", ""), growth("real one", "do this")],
      })
    );
    expect(out!.growthAreas).toHaveLength(1);
    expect(out!.growthAreas[0]!.opportunity).toBe("real one");
  });

  it("caps strengths + growth areas at 4 each", () => {
    const out = parseDissect(
      JSON.stringify({
        strengths: [1, 2, 3, 4, 5, 6].map((n) => strength(`s${n}`)),
        growthAreas: [1, 2, 3, 4, 5].map((n) => growth(`g${n}`)),
      })
    );
    expect(out!.strengths).toHaveLength(4);
    expect(out!.growthAreas).toHaveLength(4);
  });

  it("keeps standoutStrategy only when it has a name", () => {
    const named = parseDissect(
      JSON.stringify({
        strengths: [strength("x")],
        standoutStrategy: { name: "mirroring", example: "e", why: "w" },
      })
    );
    expect(named!.standoutStrategy?.name).toBe("mirroring");

    const nameless = parseDissect(
      JSON.stringify({
        strengths: [strength("x")],
        standoutStrategy: { example: "e", why: "w" },
      })
    );
    expect(nameless!.standoutStrategy).toBeNull();
  });

  it("malformed JSON → null (honest failure)", () => {
    expect(parseDissect("<not json>")).toBeNull();
  });
});
