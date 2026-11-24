// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Which tabs Remote Sales shows (MACRO-MODE-SPEC). A rep in Macro Mode gets the simplified system only; a manager's
 * flow "will not change" except for the pipeline — first read as "a manager keeps every tab"; the founder corrected it
 * on 2026-11-25 ("PDF screens + team section"): in Macro Mode everyone has Today, Pipeline, Calls.
 */
let macro: boolean | null = false;
let manager = false;
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/remote-sales" }));
vi.mock("@/lib/hooks/useRemoteMacroMode", () => ({ useRemoteMacroMode: () => ({ enabled: macro }) }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({
  useIsSalesCoachManager: () => manager,
  useCurrentUserRole: () => "Member",
  isCompanyAdminRole: () => false,
}));

import { RemoteSalesShell } from "../RemoteSalesShell";

const tabs = () => screen.getAllByRole("link").map((a) => a.textContent);
afterEach(cleanup);

describe("RemoteSalesShell tabs", () => {
  it("a rep in Macro Mode sees Today, Pipeline and Calls only", () => {
    macro = true;
    manager = false;
    render(<RemoteSalesShell>x</RemoteSalesShell>);
    expect(tabs()).toEqual(["Today", "Pipeline", "Calls"]);
  });

  it("a manager in Macro Mode sees the same three (their team section is on Pipeline)", () => {
    macro = true;
    manager = true;
    render(<RemoteSalesShell>x</RemoteSalesShell>);
    expect(tabs()).toEqual(["Today", "Pipeline", "Calls"]);
  });

  it("with Macro Mode off (or still loading), the full module — Pipeline included", () => {
    manager = false;
    for (const m of [false, null]) {
      macro = m;
      render(<RemoteSalesShell>x</RemoteSalesShell>);
      expect(tabs()).toEqual(["Calls", "Pipeline", "Scoreboard", "Search", "Library", "Training"]);
      cleanup();
    }
  });
});
