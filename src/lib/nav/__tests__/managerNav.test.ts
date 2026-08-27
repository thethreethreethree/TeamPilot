import { describe, it, expect } from "vitest";
import { filterManagerNav, filterManagerNavSections } from "../managerNav";

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

  it("hides repOnly items from a MANAGER, keeps them for a rep (Analytics merged into Coach Assessment, 2026-08-28)", () => {
    const withRepOnly = [{ label: "Home" }, { label: "Analytics", repOnly: true }, { label: "Coach Assessment", managerOnly: true }];
    // Manager: no separate Analytics (it's on the assessment card); keeps Coach Assessment.
    expect(filterManagerNav(withRepOnly, true).map((i) => i.label)).toEqual(["Home", "Coach Assessment"]);
    // Rep: keeps Analytics (their own self-view); no Coach Assessment.
    expect(filterManagerNav(withRepOnly, false).map((i) => i.label)).toEqual(["Home", "Analytics"]);
  });

  it("is a no-op on a list with no managerOnly items", () => {
    const plain: { label: string; managerOnly?: boolean }[] = [{ label: "A" }, { label: "B" }];
    expect(filterManagerNav(plain, false)).toEqual(plain);
    expect(filterManagerNav(plain, true)).toEqual(plain);
  });
});

/**
 * Grouped Sales Coach nav (founder 2026-07-31). Locks that a section whose items are ALL manager-only is
 * dropped for a rep — so a rep never sees a bare "Manager Dashboard" header with nothing beneath it (AMD-006
 * L3). A regression (e.g. keeping empty sections) would render a heading pointing at nothing.
 */
type TestItem = { label: string; managerOnly?: boolean };
type TestSection = { header?: string; items: TestItem[] };
const sections: TestSection[] = [
  { items: [{ label: "Home" }] },
  {
    header: "Manager Dashboard",
    items: [{ label: "Coach Assessment", managerOnly: true }, { label: "Analytics" }],
  },
  { header: "Manager Only", items: [{ label: "Team", managerOnly: true }] },
];

describe("filterManagerNavSections", () => {
  it("for a rep: filters manager-only items AND drops a fully-manager-only section", () => {
    const out = filterManagerNavSections(sections, false);
    // "Manager Only" (Team only) vanishes entirely; "Manager Dashboard" keeps just Analytics.
    expect(out.map((s) => s.header)).toEqual([undefined, "Manager Dashboard"]);
    expect(out[1]?.items.map((i) => i.label)).toEqual(["Analytics"]);
  });

  it("for a manager: keeps every section and every item", () => {
    const out = filterManagerNavSections(sections, true);
    expect(out.map((s) => s.header)).toEqual([undefined, "Manager Dashboard", "Manager Only"]);
    expect(out[1]?.items.map((i) => i.label)).toEqual(["Coach Assessment", "Analytics"]);
  });
});
