import { describe, expect, it } from "vitest";
import { classifySession, netSentimentFromMoments } from "../sessionFlag";

/**
 * The session interaction classifier (founder 2026-07-09). Pins the founder's
 * rules: Examination = negative interaction (lost pivot OR cooling), ANY outcome;
 * Outstanding = sold AND positive interaction; negative takes precedence over a
 * sale (a bad-but-closed call is Examination). And the §A18 property by omission:
 * the input has NO score field — the flag cannot be score-derived.
 */
describe("classifySession", () => {
  it("Outstanding: sold + gained pivot", () => {
    const f = classifySession({
      outcome: "sold",
      pivotDirection: "gained",
      sentiment: "flat",
    });
    expect(f?.kind).toBe("outstanding");
  });

  it("Outstanding: sold + warming sentiment", () => {
    const f = classifySession({
      outcome: "sold",
      pivotDirection: null,
      sentiment: "warming",
    });
    expect(f?.kind).toBe("outstanding");
  });

  it("Examination: no_sale + lost pivot", () => {
    const f = classifySession({
      outcome: "no_sale",
      pivotDirection: "lost",
      sentiment: "flat",
    });
    expect(f?.kind).toBe("examination");
  });

  it("Examination: cooling sentiment even without a lost pivot", () => {
    const f = classifySession({
      outcome: "follow_up",
      pivotDirection: null,
      sentiment: "cooling",
    });
    expect(f?.kind).toBe("examination");
  });

  it("PRECEDENCE: sold BUT the interaction went badly → Examination, not Outstanding", () => {
    const f = classifySession({
      outcome: "sold",
      pivotDirection: "lost",
      sentiment: "cooling",
    });
    expect(f?.kind).toBe("examination");
    // The headline names the sold-but-rough case explicitly.
    expect(f?.headline.toLowerCase()).toContain("sold");
  });

  it("a graceful no-sale (warm, gained ground) is NOT flagged", () => {
    const f = classifySession({
      outcome: "no_sale",
      pivotDirection: "gained",
      sentiment: "warming",
    });
    expect(f).toBeNull();
  });

  it("sold but NEUTRAL interaction (no pivot, flat sentiment) is NOT Outstanding", () => {
    // Outstanding requires a POSITIVE interaction, not merely a sale.
    const f = classifySession({
      outcome: "sold",
      pivotDirection: null,
      sentiment: "flat",
    });
    expect(f).toBeNull();
  });

  it("absent signals → no flag (only clear cases get a badge)", () => {
    expect(
      classifySession({ outcome: null, pivotDirection: null, sentiment: null })
    ).toBeNull();
  });

  describe("netSentimentFromMoments", () => {
    it("more cooling than warming → cooling", () => {
      expect(
        netSentimentFromMoments([
          { sentiment: "cooling" },
          { sentiment: "cooling" },
          { sentiment: "warming" },
        ])
      ).toBe("cooling");
    });
    it("more warming → warming", () => {
      expect(
        netSentimentFromMoments([{ sentiment: "warming" }, { sentiment: "neutral" }])
      ).toBe("warming");
    });
    it("tie with signal → flat; no signal → null", () => {
      expect(
        netSentimentFromMoments([{ sentiment: "warming" }, { sentiment: "cooling" }])
      ).toBe("flat");
      expect(
        netSentimentFromMoments([{ sentiment: "neutral" }, { sentiment: undefined }])
      ).toBeNull();
      expect(netSentimentFromMoments([])).toBeNull();
    });
  });

  it("composes manager-safe reasons from pivot + sentiment (never scores)", () => {
    const f = classifySession({
      outcome: "no_sale",
      pivotDirection: "lost",
      pivotReason: "pushed price before establishing value",
      sentiment: "cooling",
      coolingMoments: ["prospect went quiet after the quote"],
    });
    expect(f?.kind).toBe("examination");
    const labels = f?.reasons.map((r) => r.label) ?? [];
    expect(labels).toContain("Lost ground at the pivot");
    expect(labels).toContain("Prospect sentiment cooled");
    const details = f?.reasons.map((r) => r.detail).join(" ") ?? "";
    expect(details).toContain("pushed price before establishing value");
    expect(details).toContain("prospect went quiet after the quote");
  });
});
