import { describe, it, expect } from "vitest";
import {
  aggregateDissectContent,
  type DissectEventRow,
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
