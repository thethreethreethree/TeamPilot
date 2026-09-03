import { describe, it, expect } from "vitest";
import { deriveMilestoneDates, MILESTONE_KEYS } from "../milestones";

/**
 * deriveMilestoneDates — GAM-R13. The earned-at for each Arena milestone is DERIVED from the immutable ledger (+
 * sold sessions), so the date is durable + truthful by construction. These pin: the first/Nth-pitch selection,
 * the strong-threshold, the deal counts, and that inputs need not be pre-sorted.
 */
const row = (points: number, created_at: string) => ({ points, created_at });

describe("deriveMilestoneDates", () => {
  it("empty history → every milestone null (a brand-new rep, no fabricated date)", () => {
    const d = deriveMilestoneDates([], []);
    for (const k of MILESTONE_KEYS) expect(d[k]).toBeNull();
  });

  it("spark = the FIRST scored pitch's date, regardless of input order", () => {
    const d = deriveMilestoneDates(
      [row(50, "2026-03-02T00:00:00Z"), row(70, "2026-01-05T00:00:00Z"), row(60, "2026-02-01T00:00:00Z")],
      [],
    );
    expect(d.spark).toBe("2026-01-05T00:00:00Z"); // earliest by date, not first in the array
  });

  it("flame = the first STRONG (>=80) pitch; below-threshold pitches don't count", () => {
    const d = deriveMilestoneDates(
      [row(79, "2026-01-01T00:00:00Z"), row(80, "2026-01-10T00:00:00Z"), row(95, "2026-01-20T00:00:00Z")],
      [],
    );
    expect(d.flame).toBe("2026-01-10T00:00:00Z"); // 80 is strong (>=), 79 is not
  });

  it("flame stays null with no strong pitch", () => {
    expect(deriveMilestoneDates([row(70, "2026-01-01T00:00:00Z")], []).flame).toBeNull();
  });

  it("century = the 100th pitch's date; null under 100", () => {
    const under = Array.from({ length: 99 }, (_, i) => row(50, `2026-01-${String((i % 27) + 1).padStart(2, "0")}T00:00:00Z`));
    expect(deriveMilestoneDates(under, []).century).toBeNull();
    const at = Array.from({ length: 100 }, (_, i) => row(50, `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`));
    // the 100th by ascending date
    const sortedAsc = [...at].map((r) => r.created_at).sort();
    expect(deriveMilestoneDates(at, []).century).toBe(sortedAsc[99]);
  });

  it("deal = the first sold date; closer = the 10th (null under 10)", () => {
    const sold = ["2026-02-01", "2026-01-01", "2026-03-01"]; // unsorted
    const d = deriveMilestoneDates([], sold);
    expect(d.deal).toBe("2026-01-01"); // earliest
    expect(d.closer).toBeNull(); // only 3 deals
    const ten = Array.from({ length: 11 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
    expect(deriveMilestoneDates([], ten).closer).toBe("2026-01-10"); // the 10th sold, ascending
  });
});
