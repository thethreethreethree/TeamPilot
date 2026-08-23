// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup, screen } from "@testing-library/react";

/**
 * Audit F4b class-completion (2026-08-23): the mobile Pitches pill was fixed to show "—" on a failed dashboard
 * fetch (macroCardVisibility test). The DESKTOP home tiles (DeckStat) are the OTHER consumer of the same
 * `stats` state — on a fetch failure they must ALSO show "—", not a false "0" that reads as "zero activity".
 * This renders the real desktop tree with a FAILING /dashboard fetch and asserts the tiles read "—".
 *
 * NB: this file lets LearningHint render its children (the macroCardVisibility file mocks it to null, which would
 * swallow the DeckStats), so the real DeckStat values are asserted.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: false, loaded: true }), // Expert → desktop tiles path, no in_person flip
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
// Pass children through so the wrapped <DeckStat> tiles actually render (unlike the null-mock elsewhere).
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import SalesCoachHome from "../page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetchDashboardFailing() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/macro-mode")) return { ok: true, json: async () => ({ enabled: false }) };
      if (url.includes("/dashboard")) return { ok: false, status: 500, json: async () => ({}) }; // the FAILURE under test
      if (url.includes("/identity")) return { ok: true, json: async () => ({ fullName: "Rep" }) };
      return { ok: true, json: async () => ({}) };
    }),
  );
}

describe("Sales Coach desktop home tiles — honest '—' on a failed dashboard fetch (audit F4b)", () => {
  it("shows '—' on the stat tiles instead of a false '0'", async () => {
    stubFetchDashboardFailing();
    render(<SalesCoachHome />);
    // The desktop tiles are labelled distinctly from the mobile pills; confirm the desktop tree rendered.
    await waitFor(() => expect(screen.getByText("Sessions / week")).toBeTruthy());
    expect(screen.getByText("Growth reviews")).toBeTruthy();
    // On the load failure every stat value renders "—" (4 desktop tiles + the Sessions sub + the mobile Pitches
    // pill), never a "0" that reads as "no activity". Assert the honest marker appears on the desktop tiles.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });
});
