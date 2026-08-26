import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Guards the Sales Coach shell's "Browser extension" sidebar nav entry.
 *
 * Founder request (2026-08-08): surface the Sales Coach extension the SAME way C.A.R.E does — a persistent
 * left-sidebar nav item (CareShell.tsx's SECONDARY_NAV "Browser extension" entry), not only the inline download
 * cards on the dashboard page. This parity was MISSED on the first pass (shipped as page cards only), so this
 * gates it (A30 — encode the lesson so it can't be dropped again). Source-substring form: SalesCoachShell is a
 * client component, unrenderable in the node test env (same posture as the extension-client guards).
 */
const ROOT = process.cwd();
const SHELL = readFileSync(join(ROOT, "src", "components", "sales-coach", "SalesCoachShell.tsx"), "utf-8");
const CARE_SHELL = readFileSync(join(ROOT, "src", "components", "care", "CareShell.tsx"), "utf-8");

describe("SalesCoachShell — Browser extension nav parity with C.A.R.E", () => {
  it("surfaces the extension as a sidebar nav item pointing at the sales download page", () => {
    expect(SHELL).toContain('label: "Browser extension"');
    expect(SHELL).toContain('href: "/extension/download-sales"');
  });

  it("marks it external (opens the page in a new tab, leaving the fixed-overlay shell) — mirrors C.A.R.E", () => {
    // The nav item is external, and the render honors external with target=_blank + rel=noopener.
    expect(SHELL).toMatch(/label: "Browser extension"[\s\S]{0,160}external:\s*true/);
    expect(SHELL).toMatch(/item\.external[\s\S]{0,100}target:\s*"_blank"/);
    expect(SHELL).toMatch(/rel:\s*"noopener noreferrer"/);
  });

  it("C.A.R.E still has its own Browser extension entry (the pattern being mirrored)", () => {
    // If C.A.R.E's entry ever moves/renames, revisit this parity guard rather than let the two silently drift.
    expect(CARE_SHELL).toContain('label: "Browser extension"');
    expect(CARE_SHELL).toContain('href: "/extension/download"');
  });
});

/**
 * Guards the collapsible-group nav structure (founder mockup 2026-08-12). This grouping was tried on
 * 2026-07-31, REVERTED to a flat list on 2026-08-01, then re-requested WITH a collapse affordance on
 * 2026-08-12 (see docs/tbc/2026-08-12-xm-…). Because it has flip-flopped before, this test locks the current
 * founder-desired shape so it can't silently regress to a flat list (or lose the collapsibility) — A30. Same
 * source-substring form as the extension-parity guard above (client component, unrenderable in node env).
 */
describe("SalesCoachShell — collapsible Manager Dashboard + Team Tools groups", () => {
  it("declares both groups as collapsible sections", () => {
    expect(SHELL).toMatch(/header:\s*"Manager Dashboard"[\s\S]{0,120}collapsible:\s*true/);
    expect(SHELL).toMatch(/header:\s*"Team Tools"[\s\S]{0,120}collapsible:\s*true/);
  });

  it("Manager Dashboard groups Coach Assessment, Analytics, Sessions (in order)", () => {
    expect(SHELL).toMatch(
      /header:\s*"Manager Dashboard"[\s\S]{0,400}coach-assessment[\s\S]{0,200}\/analytics[\s\S]{0,200}\/sessions/
    );
  });

  it("Team Tools groups Roleplay, One Liners, Training, Team (in order)", () => {
    // "One Liners" is rendered via the ONE_LINERS_LABEL constant; assert on the stable /strategy route instead.
    // Training (founder 2026-08-26) sits between One Liners and Team; the comment before it widens the gap.
    expect(SHELL).toMatch(
      /header:\s*"Team Tools"[\s\S]{0,400}\/roleplay[\s\S]{0,200}\/strategy[\s\S]{0,400}\/training"[\s\S]{0,200}\/team"/
    );
  });

  it("Coach Assessment + Team remain manager-only inside their groups", () => {
    expect(SHELL).toMatch(/coach-assessment[\s\S]{0,140}managerOnly:\s*true/);
    expect(SHELL).toMatch(/\/team"[\s\S]{0,140}managerOnly:\s*true/);
  });

  it("renders collapsible groups as a toggle button with aria-expanded + a chevron", () => {
    expect(SHELL).toContain("aria-expanded={open}");
    expect(SHELL).toContain("setOpenGroups");
    expect(SHELL).toMatch(/ChevronDown|ChevronRight/);
  });

  it("auto-re-opens the active group so a collapse never hides the user's own location (AMD-006 L3)", () => {
    expect(SHELL).toContain("activeGroupHeader");
  });
});

describe("SalesCoachShell — Macro Mode sidebar focus (founder 2026-08-18: ONLY the two X'd entries)", () => {
  // The founder was explicit: on Macro Mode, hide EXACTLY "Live AI Coach & Sessions" (/sessions) and "One Liners"
  // (/strategy) from the sidebar — nothing else, and only in Macro Mode. Lock the set + the condition so a third
  // entry can't quietly creep in and the focus can't leak to non-Macro-Mode.
  const macroSet = SHELL.match(/const MACRO_HIDDEN_HREFS = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const hiddenHrefs = macroSet.match(/"[^"]+"/g) ?? [];

  it("hides exactly the two entries — /sessions and /strategy — and no others", () => {
    expect(hiddenHrefs).toContain('"/dashboard/sales-coach/sessions"');
    expect(hiddenHrefs).toContain('"/dashboard/sales-coach/strategy"');
    expect(hiddenHrefs.length).toBe(2); // exactly two — a third would fail here
  });

  it("applies the hide ONLY when Macro Mode is on", () => {
    // Robust to comments/formatting: the visibleSections assignment must gate the MACRO_HIDDEN_HREFS filter on
    // macroOn (a ternary), so the entries hide ONLY in Macro Mode and are shown otherwise.
    const block = SHELL.match(/const visibleSections =([\s\S]*?);\n/)?.[1] ?? "";
    expect(block).toContain("macroOn");
    expect(block).toContain("MACRO_HIDDEN_HREFS");
    expect(block).toMatch(/macroOn\s*\?/);
  });

  it("keeps a focus-out entry visible if the rep is currently ON it (AMD-006 L3 — never hide own location)", () => {
    expect(SHELL).toMatch(/MACRO_HIDDEN_HREFS\.has\(i\.href\)\s*\|\|\s*isNavItemActive\(i, pathname\)/);
  });

  it("reacts to the toggle live via the elostate:macro-mode event (no reload)", () => {
    expect(SHELL).toContain('"elostate:macro-mode"');
  });
});

describe("SalesCoachShell — Macro Mode bottom nav (founder revision 2026-08-23, annotated mockup)", () => {
  // Founder revised the Macro bottom nav (2026-08-23): promote the two door-to-door DATA surfaces
  // (Pitch Performance + Today's Metrics) into the nav for one-tap access, replacing Team Chat + AI Agent;
  // Role Play moves to the last slot. This nav has flip-flopped before (see MACRO_MOBILE_TABS history), so lock
  // the founder-chosen set + ORDER so it can't silently regress (A30).
  const macroTabs = SHELL.match(/const MACRO_MOBILE_TABS[\s\S]*?\];/)?.[0] ?? "";

  it("is exactly Home / Pitch Performance / Today's Metrics / Role Play (in order)", () => {
    for (const label of ['"Home"', '"Pitch Performance"', '"Today\'s Metrics"', '"Role Play"']) {
      expect(macroTabs).toContain(`label: ${label}`);
    }
    // Order is load-bearing (the founder placed the two data views between Home and Role Play).
    expect(macroTabs).toMatch(
      /"Home"[\s\S]*?"Pitch Performance"[\s\S]*?"Today's Metrics"[\s\S]*?"Role Play"/
    );
    // Founder-confirmed targets.
    expect(macroTabs).toContain("/dashboard/sales-coach/doors/report-card"); // Pitch Performance
    expect(macroTabs).toContain("/dashboard/sales-coach/doors/todays-metrics"); // Today's Metrics
    expect(macroTabs).toContain("/dashboard/sales-coach/roleplay"); // Role Play
  });

  it("drops the AI Agent (Sessions) + Team Chat tabs from the Macro set (founder 2026-08-23)", () => {
    expect(macroTabs).not.toContain('"AI Agent"');
    expect(macroTabs).not.toContain('"Team Chat"');
    expect(macroTabs).not.toContain("/dashboard/sales-coach/sessions");
    // The normal-mode-only tabs must NOT be in the Macro set either.
    expect(macroTabs).not.toContain('"Analytics"');
    expect(macroTabs).not.toContain('"Account"');
  });

  it("the bottom tab bar swaps to the Macro set when Macro Mode is on", () => {
    expect(SHELL).toMatch(/\(macroOn \? MACRO_MOBILE_TABS : MOBILE_TABS\)\.map/);
  });
});
