import { describe, expect, it } from "vitest";
import {
  classifySession,
  extractSessionSignals,
  gateSessionFlag,
  netSentimentFromMoments,
} from "../sessionFlag";

describe("gateSessionFlag (surface invariants)", () => {
  const exam = { kind: "examination" as const, headline: "h", reasons: [] };
  const outstanding = { kind: "outstanding" as const, headline: "h", reasons: [] };

  it("an ACTIVE session is never flagged (even with a classified flag)", () => {
    expect(gateSessionFlag(exam, { status: "active", isManager: true })).toBeNull();
    expect(
      gateSessionFlag(outstanding, { status: "active", isManager: true })
    ).toBeNull();
  });

  it("Examination is MANAGER-ONLY — a rep never sees it on their own session", () => {
    expect(gateSessionFlag(exam, { status: "ended", isManager: false })).toBeNull();
    expect(gateSessionFlag(exam, { status: "ended", isManager: true })).toBe(exam);
  });

  it("Outstanding is visible to everyone (rep + manager)", () => {
    expect(gateSessionFlag(outstanding, { status: "ended", isManager: false })).toBe(
      outstanding
    );
    expect(gateSessionFlag(outstanding, { status: "reviewed", isManager: true })).toBe(
      outstanding
    );
  });

  it("null flag stays null", () => {
    expect(gateSessionFlag(null, { status: "ended", isManager: true })).toBeNull();
  });
});

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

  // BROADENED 2026-07-09 (founder: v1 flagged almost nothing because it required
  // interaction analysis most sessions lack). no_sale is now an examination trigger
  // on its own, and a clean sale is Outstanding on its own.
  it("no_sale with NO analysis → Examination (the always-available signal)", () => {
    const f = classifySession({
      outcome: "no_sale",
      pivotDirection: null,
      sentiment: null,
    });
    expect(f?.kind).toBe("examination");
  });

  it("even a 'graceful' no_sale (warm, gained) is Examination — it didn't convert", () => {
    const f = classifySession({
      outcome: "no_sale",
      pivotDirection: "gained",
      sentiment: "warming",
    });
    expect(f?.kind).toBe("examination");
  });

  it("a breakdown moment → Examination even with no other negative signal", () => {
    const f = classifySession({
      outcome: "follow_up",
      pivotDirection: null,
      sentiment: null,
      hasBreakdown: true,
      breakdownText: "talked over the objection",
    });
    expect(f?.kind).toBe("examination");
    expect(f?.reasons.some((r) => r.detail.includes("talked over"))).toBe(true);
  });

  it("sold with NO analysis → Outstanding (a clean close is evidence enough)", () => {
    const f = classifySession({
      outcome: "sold",
      pivotDirection: null,
      sentiment: null,
    });
    expect(f?.kind).toBe("outstanding");
  });

  it("follow_up / no_contact / undecided with no negative signal → no flag", () => {
    for (const outcome of ["follow_up", "no_contact", "undecided"]) {
      expect(
        classifySession({ outcome, pivotDirection: null, sentiment: null })
      ).toBeNull();
    }
  });

  it("absent signals → no flag (only clear cases get a badge)", () => {
    expect(
      classifySession({ outcome: null, pivotDirection: null, sentiment: null })
    ).toBeNull();
  });

  describe("extractSessionSignals (the storage→classifier seam)", () => {
    // Realistic payloads matching the ACTUAL stored shapes: pivot event payload is
    // { pivot: PivotMoment }, moments event payload is { moments: SalesMoment[] }.
    // These pin the field names (direction / whatHappened / whyItMattered / sentiment
    // / note) so a drift in the stored shape fails HERE, not silently in production.
    it("extracts a lost pivot + reason + cooling sentiment from real payloads", () => {
      const pivotPayload = {
        pivot: {
          atSeq: 12,
          direction: "lost",
          label: "Lost them on price",
          whatHappened: "Quoted before value was established",
          whyItMattered: "The prospect anchored on cost and disengaged",
        },
        coach_version: "pivot-v1",
      };
      const momentsPayload = {
        moments: [
          { atSeq: 3, sentiment: "warming", note: "opened well" },
          { atSeq: 9, sentiment: "cooling", note: "went quiet after the quote" },
          { atSeq: 14, sentiment: "cooling", label: "guarded close" },
        ],
        coach_version: "moments-v1",
      };
      const sig = extractSessionSignals({
        outcome: "no_sale",
        pivotPayload,
        momentsPayload,
      });
      expect(sig.pivotDirection).toBe("lost");
      expect(sig.pivotReason).toContain("Quoted before value was established");
      expect(sig.pivotReason).toContain("anchored on cost");
      expect(sig.sentiment).toBe("cooling");
      expect(sig.coolingMoments).toContain("went quiet after the quote");
      // And end-to-end: those signals classify as Examination.
      expect(classifySession(sig)?.kind).toBe("examination");
    });

    it("extracts a gained pivot + warming for an Outstanding sold call", () => {
      const sig = extractSessionSignals({
        outcome: "sold",
        pivotPayload: {
          pivot: { direction: "gained", whatHappened: "Reframed to outcome value" },
        },
        momentsPayload: {
          moments: [
            { sentiment: "warming", note: "leaned in" },
            { sentiment: "warming", note: "asked about start dates" },
          ],
        },
      });
      expect(sig.pivotDirection).toBe("gained");
      expect(sig.sentiment).toBe("warming");
      expect(classifySession(sig)?.kind).toBe("outstanding");
    });

    it("is defensive: malformed / absent payloads → neutral signals, no throw", () => {
      expect(
        extractSessionSignals({ outcome: null, pivotPayload: null, momentsPayload: null })
      ).toEqual({
        outcome: null,
        pivotDirection: null,
        pivotReason: null,
        sentiment: null,
        hasBreakdown: false,
        breakdownText: null,
        coolingMoments: [],
        warmingMoments: [],
      });
      // Garbage shapes don't crash and don't fabricate a direction.
      const junk = extractSessionSignals({
        outcome: "sold",
        pivotPayload: { pivot: { direction: "sideways" } },
        momentsPayload: { moments: "not-an-array" },
      });
      expect(junk.pivotDirection).toBeNull();
      expect(junk.sentiment).toBeNull();
    });
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
