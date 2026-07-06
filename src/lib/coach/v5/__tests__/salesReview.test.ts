import { describe, expect, it } from "vitest";
import { parseSalesReview } from "../salesReview";

const strength = (point: string) => ({ point, example: "…" });
const growth = (opportunity: string) => ({ opportunity, nextStep: "…" });

/**
 * parseSalesReview is the structural TONE LAW guard on the post-call review.
 * The headline invariant: a review can never lead with — or consist only of —
 * criticism, so growth areas without any strength collapse to "no signal".
 */
describe("parseSalesReview — the tone law", () => {
  it("HEADLINE: growth areas but NO strengths → no signal (tone-law guard)", () => {
    const out = parseSalesReview(
      JSON.stringify({
        strengths: [],
        growthAreas: [growth("slow down before the close"), growth("ask more questions")],
      })
    );
    expect(out).toEqual({ hasSignal: false, strengths: [], growthAreas: [] });
  });

  it("a review with at least one strength has signal", () => {
    const out = parseSalesReview(
      JSON.stringify({
        strengths: [strength("strong rapport open")],
        growthAreas: [growth("handle price objection sooner")],
        closing: "you built real trust today",
      })
    );
    expect(out!.hasSignal).toBe(true);
    expect(out!.strengths).toHaveLength(1);
    expect(out!.closing).toBe("you built real trust today");
  });

  it("caps strengths and growth areas at 3 each", () => {
    const out = parseSalesReview(
      JSON.stringify({
        strengths: [1, 2, 3, 4, 5].map((n) => strength(`s${n}`)),
        growthAreas: [1, 2, 3, 4].map((n) => growth(`g${n}`)),
      })
    );
    expect(out!.strengths).toHaveLength(3);
    expect(out!.growthAreas).toHaveLength(3);
  });

  it("drops a strength with an empty point", () => {
    const out = parseSalesReview(
      JSON.stringify({ strengths: [strength(""), strength("real one")] })
    );
    expect(out!.strengths).toHaveLength(1);
    expect(out!.strengths[0]!.point).toBe("real one");
  });

  it("hasSignal:false explicitly → no signal even if strengths present", () => {
    const out = parseSalesReview(
      JSON.stringify({ hasSignal: false, strengths: [strength("x")] })
    );
    expect(out!.hasSignal).toBe(false);
  });

  it("malformed JSON → null (honest failure)", () => {
    expect(parseSalesReview("nope")).toBeNull();
  });
});
