import { describe, expect, it } from "vitest";
import { quickContentGuess } from "../useLiveCoaching";

/**
 * Instant content-based speaker attribution — the zero-latency half of the
 * live in-person separation (composes with pitch + loudness + the LLM). These
 * pin the EXACT turns from the 2026-07-06 live test where loudness mislabeled
 * agent vs prospect, so the regression can't come back. Null = "not an obvious
 * tell" → let voice + the LLM decide (that's correct, not a miss).
 */
describe("quickContentGuess — the live-test turns that were mislabeled", () => {
  it("'How about I show you the pricing?' → salesperson (offering)", () => {
    expect(
      quickContentGuess(
        "You know what? How about I show you exactly what pricing you get? Does that interest you?"
      )
    ).toBe("agent");
  });

  it("'I wanna see the pricing... can you give me more detail?' → prospect (asking)", () => {
    expect(
      quickContentGuess(
        "Mm, actually, yes. Uh, I wanna see the pricing, yeah. And can you give me more detail about the product?"
      )
    ).toBe("customer");
  });

  it("'I can give you more detail about the product' → salesperson (offering)", () => {
    // The crux: "I can give you" (offer) is the seller; "give me" (ask) is the buyer.
    expect(
      quickContentGuess("Yes, of course, I can give you more detail about the product.")
    ).toBe("agent");
  });
});

describe("quickContentGuess — the offer-vs-ask asymmetry", () => {
  it("distinguishes offering from asking for the same thing", () => {
    expect(quickContentGuess("let me show you how it works")).toBe("agent");
    expect(quickContentGuess("can you show me how it works")).toBe("customer");
    expect(quickContentGuess("I'll walk you through the pricing")).toBe("agent");
    expect(quickContentGuess("how much does it cost")).toBe("customer");
  });

  it("returns null when there is no clear content tell (voice decides)", () => {
    expect(quickContentGuess("yeah")).toBeNull();
    expect(quickContentGuess("mhm, right, okay")).toBeNull();
    expect(quickContentGuess("that makes sense, thanks")).toBeNull();
  });
});

describe("quickContentGuess — no false positives on lookalikes", () => {
  it("does NOT mislabel agent discovery/pitch that resembles a buyer ask", () => {
    // Agent asking a discovery question — "how much" but not a price ask.
    expect(quickContentGuess("how much detail do you want on the pricing?")).toBeNull();
    // Agent — "do you have" is ambiguous, must not read as a buyer ask.
    expect(quickContentGuess("do you have any questions so far?")).toBeNull();
  });

  it("does NOT mislabel a prospect describing themselves as a seller", () => {
    // "we have" is a prospect describing their org, NOT a seller offer.
    expect(quickContentGuess("we have about 50 people on the team")).toBeNull();
    expect(quickContentGuess("our team is pretty stretched right now")).toBeNull();
  });

  it("still catches genuine price asks", () => {
    expect(quickContentGuess("okay but how much does it cost")).toBe("customer");
    expect(quickContentGuess("what's the price for the full plan")).toBe("customer");
  });
});
