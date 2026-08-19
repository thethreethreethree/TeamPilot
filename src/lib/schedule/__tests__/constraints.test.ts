import { describe, it, expect } from "vitest";
import {
  shiftDurationHours,
  weekStartOf,
  isEligible,
  meetsCoverage,
  withinLimits,
  fairnessScore,
} from "../constraints";
import type { Employee } from "../types";

/**
 * Phase 2 acceptance (build plan): each predicate unit-tested INCL. boundaries (exactly-at-minimum
 * coverage, exactly-at-max-hours); hard (pass/fail) and soft (score) are not conflated. The boundary
 * tests are deliberate — an off-by-one at the coverage floor or the hours cap is the exact defect this
 * layer must not have (a shift wrongly passed as covered, or an employee wrongly blocked at the cap).
 */

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: "e1", companyId: "c1", name: "Test", role: "nurse", employmentType: "full_time",
    skills: ["iv"], certifications: ["cpr"], maxHoursWeek: 40, minHoursWeek: 0, status: "active", ...over,
  };
}

describe("shiftDurationHours", () => {
  it("computes a normal daytime shift", () => expect(shiftDurationHours("06:00", "15:00")).toBe(9));
  it("handles an overnight shift (crosses midnight)", () => expect(shiftDurationHours("22:00", "06:00")).toBe(8));
  it("a malformed time is 0, never NaN", () => {
    expect(shiftDurationHours("6:00", "15:00")).toBe(0);
    expect(shiftDurationHours("", "")).toBe(0);
  });
});

describe("weekStartOf (ISO Monday, UTC-deterministic)", () => {
  it("maps every day of a week to the same Monday", () => {
    // Mon 2026-08-17 .. Sun 2026-08-23 all belong to the week starting Mon 2026-08-17.
    for (const d of ["2026-08-17", "2026-08-20", "2026-08-23"]) expect(weekStartOf(d)).toBe("2026-08-17");
  });
  it("a Sunday belongs to the week that STARTED the prior Monday (not the next)", () => {
    expect(weekStartOf("2026-08-23")).toBe("2026-08-17"); // Sunday → Monday six days earlier
    expect(weekStartOf("2026-08-24")).toBe("2026-08-24"); // the NEXT Monday is a new week
  });
  it("dates in different weeks map to different Mondays", () => {
    expect(weekStartOf("2026-08-13")).toBe("2026-08-10"); // prior week
    expect(weekStartOf("2026-08-20")).toBe("2026-08-17"); // this week
  });
  it("malformed input is null, never a thrown error", () => {
    expect(weekStartOf("2026-8-1")).toBeNull();
    expect(weekStartOf("")).toBeNull();
  });
});

describe("isEligible (hard)", () => {
  it("eligible when active + role + all skills + all certs match", () => {
    expect(isEligible(emp(), { role: "nurse", skills: ["iv"], certifications: ["cpr"] })).toBe(true);
  });
  it("an INACTIVE employee is never eligible", () => {
    expect(isEligible(emp({ status: "inactive" }), { role: "nurse" })).toBe(false);
  });
  it("wrong role → ineligible", () => expect(isEligible(emp({ role: "cashier" }), { role: "nurse" })).toBe(false));
  it("missing a required skill → ineligible", () => expect(isEligible(emp({ skills: [] }), { skills: ["iv"] })).toBe(false));
  it("missing a required certification → ineligible", () => expect(isEligible(emp({ certifications: [] }), { certifications: ["cpr"] })).toBe(false));
  it("no role required → role is not checked", () => expect(isEligible(emp({ role: null }), { skills: ["iv"] })).toBe(true));
});

describe("meetsCoverage (hard) — boundaries", () => {
  const roleOf = (id: string) => (id.startsWith("n") ? "nurse" : "aide");

  it("EXACTLY at the minimum headcount MEETS coverage (boundary)", () => {
    expect(meetsCoverage({ assigned: ["n1", "n2"] }, { minHeadcount: 2, minByRole: {} }, roleOf)).toEqual({ meets: true, gaps: [] });
  });
  it("one below the minimum yields a headcount gap of exactly the shortfall", () => {
    const r = meetsCoverage({ assigned: ["n1"] }, { minHeadcount: 2, minByRole: {} }, roleOf);
    expect(r.meets).toBe(false);
    expect(r.gaps).toContainEqual({ kind: "headcount", need: 1 });
  });
  it("role minimums are checked per role and report every gap", () => {
    const r = meetsCoverage({ assigned: ["n1", "a1"] }, { minHeadcount: 2, minByRole: { nurse: 2, aide: 2 } }, roleOf);
    expect(r.meets).toBe(false);
    expect(r.gaps).toContainEqual({ kind: "role", role: "nurse", need: 1 });
    expect(r.gaps).toContainEqual({ kind: "role", role: "aide", need: 1 });
  });
  it("meets when headcount AND every role minimum are satisfied", () => {
    expect(meetsCoverage({ assigned: ["n1", "n2", "a1"] }, { minHeadcount: 3, minByRole: { nurse: 2, aide: 1 } }, roleOf).meets).toBe(true);
  });
});

describe("withinLimits (hard) — boundaries", () => {
  it("EXACTLY at the max hours is WITHIN (boundary — not over)", () => {
    expect(withinLimits(emp({ maxHoursWeek: 40 }), 40)).toEqual({ within: true, overBy: 0 });
  });
  it("one hour over the cap reports overBy", () => {
    expect(withinLimits(emp({ maxHoursWeek: 40 }), 41)).toEqual({ within: false, overBy: 1 });
  });
  it("no cap (null) always passes", () => {
    expect(withinLimits(emp({ maxHoursWeek: null }), 999)).toEqual({ within: true, overBy: 0 });
  });
});

describe("fairnessScore (soft — a score, never a gate)", () => {
  it("perfectly even distribution scores 1.0", () => expect(fairnessScore([30, 30, 30])).toBe(1));
  it("a lopsided distribution scores below an even one", () => {
    expect(fairnessScore([50, 10, 10])).toBeLessThan(fairnessScore([25, 25, 20]));
  });
  it("degenerate inputs (single / all-zero) score 1.0, never NaN", () => {
    expect(fairnessScore([40])).toBe(1);
    expect(fairnessScore([0, 0, 0])).toBe(1);
  });
  it("returns a number in [0,1], never a pass/fail (hard/soft not conflated)", () => {
    const s = fairnessScore([40, 5]);
    expect(typeof s).toBe("number");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
