// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup, within } from "@testing-library/react";

/**
 * Founder-reported (2026-08-18, mentioned twice): the two "focus-out" cards on the mobile Sales Coach home —
 * "Live AI Coach & Sessions" and "One Liners" — must hide ONLY when Macro Mode is ON, and show normally when it
 * is OFF ("only for Macro Mode"). The logic is a one-line `{!macroOn && ...}` guard per card, driven by a
 * GET /macro-mode fetch. This renders the REAL page against both macro states and asserts the cards appear /
 * disappear accordingly — a render-level proof (a node logic test can't see JSX conditionals) that also guards
 * against a regression silently dropping or always-hiding the cards. The confusion that triggered the report was
 * an account whose toggle was simply OFF; this locks the behavior so "is it actually wired?" is answered by CI.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: true, loaded: true }),
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({ LearningHint: () => null }));

import SalesCoachHome from "../page";

function stubFetch(macroEnabled: boolean) {
  // jsdom ships no matchMedia; a nested PWA banner probes it on mount.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/macro-mode")) return { ok: true, json: async () => ({ enabled: macroEnabled }) };
      if (url.includes("/door-log")) return { ok: true, json: async () => ({ doorsKnocked: 3, presentations: 2, sold: 1 }) };
      if (url.includes("/dashboard"))
        return {
          ok: true,
          json: async () => ({
            stats: {
              sessionsTotal: 66,
              sessionsThisWeek: 0,
              activeCount: 0,
              awaitingReview: 0,
              reviewedCount: 0,
              cuesTotal: 0,
              reviewsGenerated: 0,
              recentGrowth: [],
            },
          }),
        };
      if (url.includes("/identity")) return { ok: true, json: async () => ({ fullName: "Rep" }) };
      return { ok: true, json: async () => ({}) };
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The page ships both a mobile (`md:hidden`) and a desktop (`hidden md:flex`) tree — jsdom holds both, and they
// share card titles. Scope every query to the mobile container so we assert the mobile home the founder screenshotted.
function mobile(container: HTMLElement) {
  return within(container.querySelector('[class~="md:hidden"]') as HTMLElement);
}

describe("Sales Coach home — Macro-conditional card visibility (founder 2026-08-18)", () => {
  it("Macro OFF: all four cards show (the home is 'as it was')", async () => {
    stubFetch(false);
    const { container } = render(<SalesCoachHome />);
    const m = () => mobile(container);
    // Pitch Performance + Roleplay always present; the two focus-out cards present because Macro is OFF.
    await waitFor(() => expect(m().getByText("Live AI Coach & Sessions")).toBeTruthy());
    expect(m().getByText("One Liners")).toBeTruthy();
    expect(m().getByText("Pitch Performance")).toBeTruthy();
    // The two stat pills (not the three door bubbles).
    expect(m().getByText("Pitches")).toBeTruthy();
    expect(m().getByText("Roleplays")).toBeTruthy();
    // The primary CTA is the normal pitch-session flow (founder 2026-08-19: unchanged when Macro is OFF).
    expect(m().getByText("Start Next Pitch Session")).toBeTruthy();
    expect(m().queryByText("Start Knocking")).toBeNull();
  });

  it("audit F4b — a FAILED dashboard fetch shows Pitches '—', never a false '0' (error-as-no-data)", async () => {
    // The Pitches pill must distinguish "load failed" from "zero pitches": on a dashboard-fetch failure it shows
    // "—" (like the macro totals already do), not "0" which a rep reads as "you have no pitches".
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/macro-mode")) return { ok: true, json: async () => ({ enabled: false }) }; // macro OFF → the Pitches/Roleplays pills
        if (url.includes("/dashboard")) return { ok: false, status: 500, json: async () => ({}) }; // the FAILURE under test
        if (url.includes("/identity")) return { ok: true, json: async () => ({ fullName: "Rep" }) };
        return { ok: true, json: async () => ({}) };
      }),
    );
    const { container } = render(<SalesCoachHome />);
    const m = () => mobile(container);
    await waitFor(() => expect(m().getByText("Pitches")).toBeTruthy());
    expect(m().getByText("—")).toBeTruthy(); // honest load-failure marker (only the Pitches pill renders "—" here)
  });

  it("Macro ON: the home shows the Door Log card + door bubbles + Start Knocking; Metrics & Pitch moved to the nav (founder 2026-08-23)", async () => {
    stubFetch(true);
    const { container } = render(<SalesCoachHome />);
    const m = () => mobile(container);
    // Door Log is the remaining Macro home surface.
    await waitFor(() => expect(m().getByText("Door Log")).toBeTruthy());
    // Founder revision 2026-08-23: Today's Metrics + Pitch Performance MOVED to the Macro bottom nav
    // (MACRO_MOBILE_TABS in SalesCoachShell) — a true move, so they are NO LONGER cards on the home grid.
    expect(m().queryByText("Today's Metrics")).toBeNull();
    expect(m().queryByText("Pitch Performance")).toBeNull();
    // The normal launchpad cards are gone in Macro Mode.
    expect(m().queryByText("Live AI Coach & Sessions")).toBeNull();
    expect(m().queryByText("One Liners")).toBeNull();
    // Bubbles, not pills; the CTA goes straight to the Door Log.
    expect(m().getByText("Doors Knocked")).toBeTruthy();
    expect(m().getByText("Sold")).toBeTruthy();
    expect(m().queryByText("Roleplays")).toBeNull();
    expect(m().getByText("Start Knocking")).toBeTruthy();
    expect(m().queryByText("Start Next Pitch Session")).toBeNull();
  });
});
