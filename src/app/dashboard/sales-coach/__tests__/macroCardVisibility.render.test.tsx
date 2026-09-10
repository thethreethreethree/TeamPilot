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
      // Macro home is now the swipeable pager; page 0 (DoorScreen) fetches the day target.
      if (url.includes("day-target"))
        return {
          ok: true,
          json: async () => ({
            localDate: "2026-09-10",
            repName: "Rep",
            target: { doorsTarget: 80, presentationsTarget: 18, soldTarget: 2, usedStarter: true, salesGoal: 2, closeRatio: null, contactRatio: null, saleValueCents: null },
            today: { doors: 3, presentations: 2, sold: 1 },
          }),
        };
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
    // Pitch Analytics (renamed from "Pitch Performance", audit F3) + Roleplay always present; the two focus-out
    // cards present because Macro is OFF.
    await waitFor(() => expect(m().getByText("Live AI Coach & Sessions")).toBeTruthy());
    expect(m().getByText("One Liners")).toBeTruthy();
    expect(m().getByText("Pitch Analytics")).toBeTruthy();
    // The label collision is resolved: "Pitch Performance" is no longer a non-macro card (it uniquely means the
    // macro report-card tab now).
    expect(m().queryByText("Pitch Performance")).toBeNull();
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

  it("Macro ON: the home is the swipeable pager — door tracker (page 0) + the original Macro home (page 1) with Door Log + Start Knocking (founder 2026-09-10)", async () => {
    stubFetch(true);
    const { container } = render(<SalesCoachHome />);
    const m = () => mobile(container);
    // Page 0 — the door tracker: the target sentence + the tap hint render once the day-target fetch resolves.
    await waitFor(() => expect(m().getByText(/Today's door target/i)).toBeTruthy());
    expect(m().getByText(/Tap a dial to log one/i)).toBeTruthy();
    // The pager itself: two dots + the swipe hint (the "make it swipeable" piece).
    expect(m().getByText(/Swipe left for your home screen/i)).toBeTruthy();
    // Page 1 — the original Macro home is still reachable by swipe: Door Log card + Start Knocking CTA.
    expect(m().getByText("Door Log")).toBeTruthy();
    expect(m().getByText("Start Knocking")).toBeTruthy();
    expect(m().queryByText("Start Next Pitch Session")).toBeNull();
    // The normal launchpad cards + the removed page-1 door bubbles are gone in Macro Mode.
    expect(m().queryByText("Live AI Coach & Sessions")).toBeNull();
    expect(m().queryByText("One Liners")).toBeNull();
    expect(m().queryByText("Doors Knocked")).toBeNull(); // the 3 all-time bubbles were removed (page 0 owns the funnel)
    expect(m().queryByText("Today's Metrics")).toBeNull();
    expect(m().queryByText("Pitch Performance")).toBeNull();
  });
});
