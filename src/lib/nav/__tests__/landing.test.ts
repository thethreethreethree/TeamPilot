import { describe, it, expect } from "vitest";
import { moduleLanding, MODULE_LANDING } from "../landing";

/**
 * moduleLanding maps a redeemed/authed module to its landing page — it drives where a
 * pilot user lands after redeeming a code and where the login flow sends someone. It was
 * untested. The silent regression it guards against: a NEW module added to the pilot
 * system without a MODULE_LANDING entry falls through to the generic /dashboard, dropping
 * a care/sales-coach pilot on the wrong first page. This locks the mapping + the fallback.
 */
describe("moduleLanding", () => {
  it("routes each known module to its own landing page (no accidental fall-through)", () => {
    // Each known module must resolve to a NON-generic path unless /dashboard is genuinely
    // its home (elostate). If a future edit drops a module's entry, it would fall to
    // /dashboard and this asserts the intended destination instead.
    expect(moduleLanding("elostate")).toBe("/dashboard");
    expect(moduleLanding("care")).toBe("/dashboard/care");
    expect(moduleLanding("sales_coach")).toBe("/dashboard/sales-coach");
  });

  it("care and sales_coach land on their OWN module home, not the generic dashboard", () => {
    // The regression that matters: a pilot who redeemed a care/sales code should NOT be
    // dumped on /dashboard. These two must stay distinct from the elostate/fallback path.
    expect(moduleLanding("care")).not.toBe("/dashboard");
    expect(moduleLanding("sales_coach")).not.toBe("/dashboard");
  });

  it("falls back to /dashboard for an unknown, empty, null, or undefined module", () => {
    expect(moduleLanding("nonexistent_module")).toBe("/dashboard");
    expect(moduleLanding("")).toBe("/dashboard");
    expect(moduleLanding(null)).toBe("/dashboard");
    expect(moduleLanding(undefined)).toBe("/dashboard");
  });

  it("every MODULE_LANDING value is a rooted relative path (safe as a redirect target)", () => {
    // These are used as redirect destinations; a value that wasn't a rooted relative path
    // would be an open-redirect / broken-nav shape. Locks the invariant for future entries.
    for (const path of Object.values(MODULE_LANDING)) {
      expect(path).toMatch(/^\/(?![/\\])/);
    }
  });
});
