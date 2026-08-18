import { describe, it, expect } from "vitest";
import { computeLocalSalesDate } from "../salesDay";

/**
 * 5.5 — a late-evening knock lands on the RIGHT sales day in the rep's timezone, not the UTC day.
 */
describe("computeLocalSalesDate", () => {
  it("an 11:58pm PDT knock stays on that local day (not the next UTC day)", () => {
    // 2026-08-18 23:58 PDT = 2026-08-19 06:58 UTC. The UTC-slice bug would return 2026-08-19.
    const instant = new Date("2026-08-19T06:58:00Z");
    expect(computeLocalSalesDate(instant, "America/Los_Angeles")).toBe("2026-08-18");
  });

  it("just-after-midnight local rolls to the new sales day", () => {
    // 2026-08-19 00:02 PDT = 2026-08-19 07:02 UTC.
    const instant = new Date("2026-08-19T07:02:00Z");
    expect(computeLocalSalesDate(instant, "America/Los_Angeles")).toBe("2026-08-19");
  });

  it("the same instant is a different sales day in different timezones", () => {
    const instant = new Date("2026-08-19T06:58:00Z");
    expect(computeLocalSalesDate(instant, "America/Los_Angeles")).toBe("2026-08-18"); // PDT
    expect(computeLocalSalesDate(instant, "Asia/Tokyo")).toBe("2026-08-19"); // JST (UTC+9)
  });
});
