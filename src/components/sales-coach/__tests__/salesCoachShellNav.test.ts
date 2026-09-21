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
// Normalize CRLF→LF: the assertions below use byte-sensitive char-window regexes ([\s\S]{0,N}) against the raw
// source. On Windows (core.autocrlf=true) the working-tree copy is CRLF, and each extra \r overflows those windows,
// red-failing tests that are green on CI/LF. Reading LF-normalized makes the test EOL-agnostic (the committed form
// is LF regardless). See memory: source-text regex test fails on Windows CRLF.
const readLF = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf-8").replace(/\r\n/g, "\n");
const SHELL = readLF("src", "components", "sales-coach", "SalesCoachShell.tsx");

/**
 * The SIDEBAR only — `NAV_SECTIONS`, not the mobile tab bars below it.
 *
 * The distinction is load-bearing for the ruling this file records: Analytics and Sessions were
 * dropped from the sidebar and are still in MOBILE_TABS, so asserting their absence against the
 * whole file would be false, and asserting it against nothing would let a real removal pass.
 */
const NAV_SECTIONS_SRC = (() => {
  const start = SHELL.indexOf("const NAV_SECTIONS");
  // To the END OF THE ARRAY LITERAL, not to the next function: between them sits
  // MACRO_HIDDEN_HREFS, whose contents are route strings and not nav entries. Slicing past it
  // made this constant report hrefs the sidebar does not have.
  return SHELL.slice(start, SHELL.indexOf("\n];", start));
})();
const CARE_SHELL = readLF("src", "components", "care", "CareShell.tsx");

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
 * Guards the collapsible-group nav structure.
 *
 * HISTORY, because this has flip-flopped and the history is the reason the guard exists: grouped
 * 2026-07-31, flattened 2026-08-01, re-grouped WITH collapse 2026-08-12, and restructured again by the
 * 2026-09-19 coaching redesign (docs/SYSTEM UPDATES AND REVISION). The redesign splits the two roles
 * apart — a manager gets "Manager Dashboard", a rep gets the new "My Coaching" — and promotes the old
 * ungrouped bottom run into a headed "Team Tools" group.
 *
 * The assertions below pin the 2026-09-19 shape. The final test is the important one: it locks the
 * items the redesign's mockups did NOT draw but which were deliberately RETAINED, so a later pass
 * cannot quietly delete a working feature on the authority of a drawing of a different page.
 */
describe("SalesCoachShell — role-split nav groups (2026-09-19 redesign)", () => {
  it("declares all three groups as collapsible sections", () => {
    expect(SHELL).toMatch(/header:\s*"Manager Dashboard"[\s\S]{0,400}collapsible:\s*true/);
    expect(SHELL).toMatch(/header:\s*"My Coaching"[\s\S]{0,400}collapsible:\s*true/);
    expect(SHELL).toMatch(/header:\s*"Team Tools"[\s\S]{0,400}collapsible:\s*true/);
  });

  it("Manager Dashboard puts Pattern Interrupt immediately after Score Calibration", () => {
    // Position is explicit in the build guide: "Add Pattern Interrupt to the side menu under Manager
    // Dashboard, after Score Calibration."
    expect(SHELL).toMatch(
      /header:\s*"Manager Dashboard"[\s\S]{0,900}coach-assessment[\s\S]{0,400}\/calibration[\s\S]{0,400}\/pattern-interrupt/
    );
  });

  it("My Coaching is the rep's group: My Progress, Pattern Interrupt, Role Play (in order)", () => {
    expect(SHELL).toMatch(
      /header:\s*"My Coaching"[\s\S]{0,900}\/my-progress[\s\S]{0,400}\/pattern-interrupt[\s\S]{0,400}\/roleplay/
    );
  });

  it("the two workspace groups are cleanly role-split, so neither role sees a group it cannot use", () => {
    // Every Manager Dashboard item managerOnly and every My Coaching item repOnly is what makes
    // filterManagerNavSections drop the whole group for the other role (AMD-006 L3 — no bare header,
    // no nav item that bounces you).
    // Slice each group by its header rather than regex across newlines: the group bodies contain
    // braces and comments, which a brace-matching pattern gets wrong.
    const sliceGroup = (header: string) => {
      const from = SHELL.indexOf(`header: "${header}"`);
      if (from < 0) return "";
      const next = SHELL.indexOf("header: \"", from + 10);
      return SHELL.slice(from, next < 0 ? SHELL.length : next);
    };
    const managerGroup = sliceGroup("Manager Dashboard");
    const repGroup = sliceGroup("My Coaching");
    expect(managerGroup).toBeTruthy();
    expect(repGroup).toBeTruthy();

    const managerItems = managerGroup.match(/\{ label: "[^"]+", href:[^}]+\}/g) ?? [];
    const repItems = repGroup.match(/\{ label: "[^"]+", href:[^}]+\}/g) ?? [];
    expect(managerItems.length).toBeGreaterThan(0);
    expect(repItems.length).toBeGreaterThan(0);
    for (const item of managerItems) expect(item).toContain("managerOnly: true");
    for (const item of repItems) expect(item).toContain("repOnly: true");
  });

  it("Pattern Interrupt is reachable by BOTH roles and carries the NEW badge", () => {
    // The guide gives reps their own view of the same screen ("Rep web view ... the same Patterns
    // screen limited to the rep's own patterns"), so exactly two entries point at the route.
    const entries = SHELL.match(/\/dashboard\/sales-coach\/pattern-interrupt/g) ?? [];
    expect(entries.length).toBe(2);
    expect(SHELL).toMatch(/pattern-interrupt"[\s\S]{0,120}managerOnly:\s*true[\s\S]{0,60}badge:\s*"NEW"/);
    expect(SHELL).toMatch(/pattern-interrupt"[\s\S]{0,120}repOnly:\s*true[\s\S]{0,60}badge:\s*"NEW"/);
  });

  it("Team Tools is a headed group and KPI Analytics stays manager-only", () => {
    // The rep board's Team Tools shows four items (no KPI Analytics; My Progress has moved up into
    // My Coaching), the manager board six.
    expect(SHELL).toMatch(/header:\s*"Team Tools"[\s\S]{0,900}\/team-chat[\s\S]{0,900}\/settings/);
    expect(SHELL).toMatch(/\/kpi"[\s\S]{0,140}managerOnly:\s*true/);
  });

  it("DROPS from the sidebar the destinations the 2026-09-19 boards do not draw", () => {
    // THE DECISION THIS TEST INVITED. Its previous version retained Sessions, Training, Team, One
    // Liners and Analytics on the reasoning that "an omission in a mockup OF A DIFFERENT PAGE is
    // not an instruction to delete a feature", and said in as many words: "If the founder later
    // decides to drop one, this test is where that decision gets recorded."
    //
    // Recorded. Founder ruling 2026-09-22, after the boards were opened and read: "follow the
    // boards literally" for the manager nav and "three, as the boards show" for My Coaching.
    // `Pattern Interrupt  manager Patterns (web).pdf` draws MANAGER DASHBOARD as three items and
    // TEAM TOOLS as six; `Pattern Interrupt  rep (web).pdf` draws MY COACHING as three and TEAM
    // TOOLS as four. None of the five appears in either.
    for (const href of [
      "/dashboard/sales-coach/sessions",
      "/dashboard/sales-coach/training",
      "/dashboard/sales-coach/team\"",
      "/dashboard/sales-coach/strategy",
      "/dashboard/sales-coach/analytics",
    ]) {
      expect(NAV_SECTIONS_SRC).not.toContain(href);
    }
  });

  it("keeps Analytics, Sessions and Role Play reachable on mobile, so only three go dark", () => {
    // Checked rather than assumed, because "dropped from the sidebar" and "unreachable" are
    // different claims and only one of them is true here. MOBILE_TABS and MACRO_MOBILE_TABS are
    // outside NAV_SECTIONS and were not touched by the ruling — and MACRO_MOBILE_TABS is already
    // exactly the rep board's bottom bar (Home · Pitch Performance · Today's Metrics · Role Play).
    expect(SHELL).toMatch(/MOBILE_TABS[\s\S]{0,600}\/analytics/);
    expect(SHELL).toMatch(/MOBILE_TABS[\s\S]{0,600}\/sessions/);
    expect(SHELL).toMatch(/MACRO_MOBILE_TABS[\s\S]{0,600}\/roleplay/);
    // Training, Team and One Liners are in neither. That is the open item, asserted so it cannot
    // be forgotten: if a later build re-links one, this test says so out loud.
    expect(NAV_SECTIONS_SRC).not.toContain("/dashboard/sales-coach/training");
    expect(NAV_SECTIONS_SRC).not.toContain("/dashboard/sales-coach/strategy");
    // And the Macro-Mode hide list, which used to name the two entries the ruling deleted, no
    // longer names hrefs that are not in the sidebar.
    expect(SHELL).toContain("MACRO_HIDDEN_HREFS = new Set<string>([])");
  });

  it("Coach Assessment stays manager-only", () => {
    expect(SHELL).toMatch(/coach-assessment[\s\S]{0,140}managerOnly:\s*true/);
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
  const macroSet = SHELL.match(/const MACRO_HIDDEN_HREFS = new Set<?string?>?\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const hiddenHrefs = macroSet.match(/"[^"]+"/g) ?? [];

  it("is EMPTY, because the ruling deleted both entries outright", () => {
    // SUPERSEDED 2026-09-22, and the supersession is the interesting part. The founder's
    // 2026-08-18 decision was "on Macro Mode, hide exactly /sessions and /strategy". The
    // 2026-09-22 ruling ("follow the boards literally") removed both from the sidebar for every
    // mode, so the older decision has nothing left to act on — it was not reversed, it was
    // overtaken.
    //
    // The set stays declared and the mechanism below stays tested: re-adding an entry is one
    // line. What must NOT survive is two hrefs sitting in a hide-list that are not in
    // NAV_SECTIONS at all, because the next reader takes that as evidence the sidebar has them.
    expect(hiddenHrefs.length).toBe(0);
    expect(NAV_SECTIONS_SRC).not.toContain("/dashboard/sales-coach/sessions");
    expect(NAV_SECTIONS_SRC).not.toContain("/dashboard/sales-coach/strategy");
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
