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
