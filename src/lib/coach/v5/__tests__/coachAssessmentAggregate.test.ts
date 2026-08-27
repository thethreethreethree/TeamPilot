import { describe, it, expect } from "vitest";
import {
  aggregateDissectContent,
  aggregateCoachingContent,
  type DissectEventRow,
  type PitchAnalysisRow,
} from "../coachAssessmentAggregate";

/**
 * Guards the manager coach-assessment payload extraction (the per-rep fix, 2026-08-06 `6bb9145f`).
 * The route fetches each rep's recent dissect events; this pure core turns their payloads into the
 * coaching signal. A regression here (payload key drift, a thrown error on a malformed shape, or a
 * lastAt that isn't the most-recent) would silently corrupt a manager's coaching view.
 */
describe("aggregateDissectContent", () => {
  it("extracts strengths.point / growth_areas.opportunity / standout_strategy.name", () => {
    const rows: DissectEventRow[] = [
      {
        created_at: "2026-08-06T10:00:00Z",
        payload: {
          strengths: [{ point: "Strong open" }, { point: "Good discovery" }],
          growth_areas: [{ opportunity: "Slow to close" }],
          standout_strategy: { name: "Mirroring" },
        },
      },
    ];
    const out = aggregateDissectContent(rows);
    expect(out.strengths).toEqual(["Strong open", "Good discovery"]);
    expect(out.growth).toEqual(["Slow to close"]);
    expect(out.strategies).toEqual(["Mirroring"]);
  });

  it("concatenates across multiple rows and sets lastAt to the FIRST (newest-first) row", () => {
    const rows: DissectEventRow[] = [
      {
        created_at: "2026-08-06T12:00:00Z", // newest — callers pass created_at DESC
        payload: { strengths: [{ point: "A" }] },
      },
      {
        created_at: "2026-08-01T09:00:00Z",
        payload: { strengths: [{ point: "B" }], growth_areas: [{ opportunity: "G" }] },
      },
    ];
    const out = aggregateDissectContent(rows);
    expect(out.strengths).toEqual(["A", "B"]);
    expect(out.growth).toEqual(["G"]);
    expect(out.lastAt).toBe("2026-08-06T12:00:00Z");
  });

  it("degrades to empty on malformed / missing shapes without throwing", () => {
    const rows: DissectEventRow[] = [
      { created_at: null, payload: null },
      { created_at: "2026-08-06T10:00:00Z", payload: {} },
      { created_at: "x", payload: { strengths: "not-an-array", standout_strategy: 42 } },
      {
        created_at: "y",
        payload: {
          strengths: [{ point: 123 }, { notPoint: "ignored" }], // non-string point dropped
          growth_areas: [{ opportunity: null }],
          standout_strategy: { name: 7 }, // non-string name dropped
        },
      },
    ];
    const out = aggregateDissectContent(rows);
    expect(out.strengths).toEqual([]);
    expect(out.growth).toEqual([]);
    expect(out.strategies).toEqual([]);
    // lastAt is the first row that HAS a string created_at (row 0's is null).
    expect(out.lastAt).toBe("2026-08-06T10:00:00Z");
  });

  it("empty input → empty content, null lastAt", () => {
    const out = aggregateDissectContent([]);
    expect(out).toEqual({ strengths: [], growth: [], strategies: [], lastAt: null });
  });
});

/**
 * The merge that feeds DOOR PITCHES into the manager coach-assessment (founder 2026-08-27). A rep who pitches all day
 * builds Doing Well / Coaching Focus from their pitch analyses (plain-string strengths/improvements), interleaved
 * newest-first with any coaching-session dissects — so their card is no longer blank.
 */
describe("aggregateCoachingContent (dissects + door pitches)", () => {
  it("maps pitch strengths→Doing Well, improvements→Coaching Focus (plain strings)", () => {
    const pitches: PitchAnalysisRow[] = [
      { created_at: "2026-08-27T10:00:00Z", strengths: ["Great rapport", "Clear value"], improvements: ["Ask for the close"] },
    ];
    const out = aggregateCoachingContent([], pitches);
    expect(out.strengths).toEqual(["Great rapport", "Clear value"]);
    expect(out.growth).toEqual(["Ask for the close"]);
    expect(out.lastAt).toBe("2026-08-27T10:00:00Z");
  });

  it("INTERLEAVES dissects + pitches newest-first (a recent pitch leads a stale session)", () => {
    const dissects: DissectEventRow[] = [
      { created_at: "2026-08-20T09:00:00Z", payload: { strengths: [{ point: "Old session strength" }], growth_areas: [{ opportunity: "Old growth" }] } },
    ];
    const pitches: PitchAnalysisRow[] = [
      { created_at: "2026-08-27T09:00:00Z", strengths: ["New pitch strength"], improvements: ["New pitch focus"] },
    ];
    const out = aggregateCoachingContent(dissects, pitches);
    expect(out.strengths).toEqual(["New pitch strength", "Old session strength"]); // pitch (newer) first
    expect(out.growth).toEqual(["New pitch focus", "Old growth"]);
    expect(out.lastAt).toBe("2026-08-27T09:00:00Z"); // the pitch is the most recent signal
  });

  it("a pure-pitcher (no dissects) still gets content — the core fix", () => {
    const out = aggregateCoachingContent([], [
      { created_at: "2026-08-27T08:00:00Z", strengths: ["Did well"], improvements: ["Work on X"] },
    ]);
    expect(out.strengths).toEqual(["Did well"]);
    expect(out.growth).toEqual(["Work on X"]);
  });

  it("degrades on malformed pitch rows without throwing (non-array / non-string dropped)", () => {
    const out = aggregateCoachingContent([], [
      { created_at: null, strengths: "not-an-array", improvements: null },
      { created_at: "2026-08-27T08:00:00Z", strengths: [1, "", "  ", "Real"], improvements: [] },
    ] as unknown as PitchAnalysisRow[]);
    expect(out.strengths).toEqual(["Real"]); // number, empty, whitespace dropped
    expect(out.growth).toEqual([]);
  });
});
