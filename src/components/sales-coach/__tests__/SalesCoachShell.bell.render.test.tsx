// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Exactly one bell in the Sales Coach shell (review 2026-11-26). The sidebar bell and the phone bell were both mounted
 * (CSS hid one): two pollers, and a shared Realtime channel that left one bell without live updates. The shell now
 * mounts one, chosen by screen size; on a phone it sits in the tab bar, so it covers no page's controls.
 */
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/sales-coach/kpi" }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "member", isCompanyAdminRole: () => false }));
vi.mock("@/components/learning/LearningModeFab", () => ({ LearningModeFab: () => null }));
vi.mock("@/lib/supabase/client", () => ({ supabaseEnabled: false, createClient: () => ({}) }));

import { SalesCoachShell } from "../SalesCoachShell";

const screenIs = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("min-width") ? desktop : false, addEventListener: () => {}, removeEventListener: () => {} }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const bells = () => screen.queryAllByRole("button", { name: /^Notifications/ });

describe("Sales Coach shell — one bell", () => {
  it.each([[true, "desktop"], [false, "phone"]])("mounts exactly one bell on %s (%s)", async (desktop) => {
    screenIs(desktop as boolean);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ notifications: [], unread: 0, total: 0 }) })));
    render(<SalesCoachShell><p>page</p></SalesCoachShell>);
    await screen.findByText("page");
    expect(bells()).toHaveLength(1);
  });

  it("collapsing the sidebar keeps one bell (in the collapsed strip)", async () => {
    screenIs(true);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ notifications: [], unread: 0, total: 0 }) })));
    render(<SalesCoachShell><p>page</p></SalesCoachShell>);
    await screen.findByText("page");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Sales Coach navigation" }));
    expect(bells()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Expand Sales Coach navigation" })).toBeTruthy();
  });
});
