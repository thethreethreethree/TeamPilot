import { describe, it, expect } from "vitest";
import { filterManagerNav } from "../managerNav";

/**
 * Locks the manager-only nav visibility rule shared by CareShell + SalesCoachShell.
 * A regression here (e.g. an inverted predicate) would re-expose manager-gated nav
 * items to every user — the AMD-006 L3 "nav stalls the user" class this closed.
 */
const items = [
  { label: "Patterns" },
  { label: "Team", managerOnly: true },
  { label: "Analytics" },
  { label: "Coach Assessment", managerOnly: true },
];

describe("filterManagerNav", () => {
  it("hides managerOnly items from a non-manager (isManager=false — the loading/rep default)", () => {
    const out = filterManagerNav(items, false).map((i) => i.label);
    expect(out).toEqual(["Patterns", "Analytics"]);
  });

  it("shows every item to a manager", () => {
    const out = filterManagerNav(items, true).map((i) => i.label);
    expect(out).toEqual(["Patterns", "Team", "Analytics", "Coach Assessment"]);
  });

  it("always keeps non-managerOnly items regardless of role", () => {
    for (const isMgr of [true, false]) {
      const out = filterManagerNav(items, isMgr).map((i) => i.label);
      expect(out).toContain("Patterns");
      expect(out).toContain("Analytics");
    }
  });

  it("is a no-op on a list with no managerOnly items", () => {
    const plain: { label: string; managerOnly?: boolean }[] = [{ label: "A" }, { label: "B" }];
    expect(filterManagerNav(plain, false)).toEqual(plain);
    expect(filterManagerNav(plain, true)).toEqual(plain);
  });
});
